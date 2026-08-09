/**
 * Server-side GitHub operations using Octokit.
 * Reads the GitHub token from the user_secrets table — never exposed to the browser.
 */

import { Octokit } from '@octokit/rest';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { FileEntry } from './store';

/** Thrown when the user has no usable GitHub token (never linked, or revoked). */
export class GitHubAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubAuthError';
  }
}

/**
 * Single place every GitHub route maps errors to a response, so a revoked
 * token reads as "re-link GitHub" instead of a generic 500.
 */
export function githubErrorResponse(err: unknown, fallback: string): NextResponse {
  if (err instanceof GitHubAuthError) {
    return NextResponse.json({ error: err.message, code: 'github_unlinked' }, { status: 403 });
  }
  const status = (err as { status?: number } | null)?.status;
  if (status === 401) {
    return NextResponse.json(
      { error: 'GitHub token expired or revoked. Please re-link your GitHub account.', code: 'github_unlinked' },
      { status: 403 },
    );
  }
  if (status === 403) {
    return NextResponse.json(
      { error: 'GitHub rejected the request (rate limit or missing scope). Try re-linking your account.', code: 'github_forbidden' },
      { status: 403 },
    );
  }
  if (status === 404) {
    return NextResponse.json({ error: 'Repository or branch not found', code: 'not_found' }, { status: 404 });
  }
  if (status === 409 || status === 422) {
    return NextResponse.json(
      { error: 'GitHub rejected the change — the branch may have moved. Pull the latest changes and retry.', code: 'conflict' },
      { status: 409 },
    );
  }
  console.error('[github]', fallback, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Files that are pointless (or destructive) to pull into a text sandbox. */
const BINARY_EXT = new Set([
  'png','jpg','jpeg','gif','webp','avif','ico','bmp','tiff','svgz',
  'pdf','zip','gz','tar','rar','7z','bz2',
  'mp3','mp4','mov','avi','webm','wav','ogg','flac',
  'woff','woff2','ttf','otf','eot',
  'exe','dll','so','dylib','bin','wasm','class','jar',
  'db','sqlite','sqlite3','psd','ai','sketch','node',
]);
const MAX_CLONE_FILES = 800;
const MAX_CLONE_FILE_BYTES = 256 * 1024;   // 256 KB per file
const MAX_CLONE_TOTAL_BYTES = 8 * 1024 * 1024; // 8 MB per clone
const CLONE_CONCURRENCY = 8;

/**
 * Get an authenticated Octokit instance for the current user.
 * Reads the stored GitHub token from the database.
 */
export async function getAuthenticatedOctokit(): Promise<Octokit> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new GitHubAuthError('Not authenticated');
  }

  const { data: secrets, error } = await supabase
    .from('user_secrets')
    .select('github_token')
    .eq('user_id', user.id)
    .single();

  if (error || !secrets?.github_token) {
    throw new GitHubAuthError('GitHub not linked. Please link your GitHub account first.');
  }

  return new Octokit({ auth: secrets.github_token });
}

export async function getGitHubUser() {
  const octokit = await getAuthenticatedOctokit();
  const { data } = await octokit.rest.users.getAuthenticated();
  return {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
    email: data.email,
  };
}

export async function listRepositories(options?: {
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  per_page?: number;
}) {
  const octokit = await getAuthenticatedOctokit();
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: options?.sort || 'updated',
    per_page: options?.per_page || 30,
  });

  return data.map((repo) => ({
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    html_url: repo.html_url,
    private: repo.private,
    updated_at: repo.updated_at,
  }));
}

export async function createRepository(
  name: string,
  description: string,
  isPrivate: boolean = false
) {
  const octokit = await getAuthenticatedOctokit();

  // Sanitize name the same way GitHub does: spaces → hyphens, strip invalid chars
  const sanitized = name.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');

  try {
    const { data } = await octokit.rest.repos.createForAuthenticatedUser({
      name: sanitized,
      description,
      private: isPrivate,
      auto_init: true, // Creates initial commit so the repo is never empty
    });

    return {
      name: data.name,
      full_name: data.full_name,
      html_url: data.html_url,
      clone_url: data.clone_url,
    };
  } catch (error) {
    // If repo already exists, return it based on the authenticated user
    if ((error as { status?: number })?.status === 422) {
      const { data: user } = await octokit.rest.users.getAuthenticated();
      const login = user.login;

      return {
        name: sanitized,
        full_name: `${login}/${sanitized}`,
        html_url: `https://github.com/${login}/${sanitized}`,
        clone_url: `https://github.com/${login}/${sanitized}.git`,
      };
    }
    throw error;
  }
}

export async function pushToRepository(
  owner: string,
  repo: string,
  files: Record<string, FileEntry>,
  commitMessage: string,
  branch: string = 'main'
) {
  const octokit = await getAuthenticatedOctokit();

  // Check if the branch exists (and thus if the repo has any commits)
  let refSha: string | null = null;
  try {
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    refSha = refData.object.sha;
  } catch (error) {
    // 404 = branch doesn't exist, 409 = repo is completely empty
    const status = (error as { status?: number })?.status;
    if (status !== 404 && status !== 409) {
      throw error;
    }
  }

  if (refSha) {
    // --- Normal push: repo has commits on this branch ---
    const { data: commitData } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: refSha,
    });

    const blobs = await Promise.all(
      Object.entries(files).map(async ([path, entry]) => {
        const { data: blobData } = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(entry.content).toString('base64'),
          encoding: 'base64',
        });
        return {
          path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blobData.sha,
        };
      })
    );

    const { data: treeData } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: commitData.tree.sha,
      tree: blobs,
    });

    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: treeData.sha,
      parents: [refSha],
    });

    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });
  } else {
    // --- Initial push: repo is empty or branch doesn't exist ---
    // createBlob also fails on empty repos, so use inline content in createTree
    const tree = Object.entries(files).map(([path, entry]) => ({
      path,
      mode: '100644' as const,
      type: 'blob' as const,
      content: entry.content,
    }));

    const { data: treeData } = await octokit.rest.git.createTree({
      owner,
      repo,
      tree,
    });

    const { data: commitData } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: treeData.sha,
      parents: [],
    });

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: commitData.sha,
    });
  }
}

export async function cloneRepository(
  owner: string,
  repo: string,
  branch?: string
): Promise<Record<string, FileEntry>> {
  const octokit = await getAuthenticatedOctokit();

  // No branch given → use the repo's real default branch. Assuming "main"
  // broke every repo still on "master" with a bare 404.
  let targetBranch = branch;
  if (!targetBranch) {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    targetBranch = repoData.default_branch || 'main';
  }

  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${targetBranch}`,
  });

  const { data: commitData } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: refData.object.sha,
  });

  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: commitData.tree.sha,
    recursive: 'true',
  });

  const files: Record<string, FileEntry> = {};

  // Skip binaries, oversized files and vendored dirs before fetching anything —
  // a repo with a few large assets used to serialize hundreds of blob requests
  // and hand the browser megabytes of mojibake.
  const wanted = treeData.tree.filter((item) => {
    if (item.type !== 'blob' || !item.sha || !item.path) return false;
    if (/(^|\/)(node_modules|\.git|dist|build|\.next|vendor)\//.test(item.path)) return false;
    const ext = item.path.split('.').pop()?.toLowerCase() || '';
    if (BINARY_EXT.has(ext)) return false;
    if ((item.size ?? 0) > MAX_CLONE_FILE_BYTES) return false;
    return true;
  });

  const skipped = treeData.tree.filter((i) => i.type === 'blob').length - wanted.length;
  const selected = wanted.slice(0, MAX_CLONE_FILES);
  let totalBytes = 0;

  for (let i = 0; i < selected.length; i += CLONE_CONCURRENCY) {
    const batch = selected.slice(i, i + CLONE_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (item) => {
        try {
          const { data: blobData } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: item.sha!,
          });
          const buf = Buffer.from(blobData.content, blobData.encoding === 'base64' ? 'base64' : 'utf-8');
          // NUL byte ⇒ binary that slipped past the extension check
          if (buf.includes(0)) return null;
          return { path: item.path!, content: buf.toString('utf-8'), bytes: buf.length };
        } catch (error) {
          console.warn(`Failed to fetch blob for ${item.path}:`, error);
          return null;
        }
      })
    );

    for (const r of results) {
      if (!r) continue;
      if (totalBytes + r.bytes > MAX_CLONE_TOTAL_BYTES) {
        console.warn(`[clone] ${owner}/${repo} truncated at ${MAX_CLONE_TOTAL_BYTES} bytes`);
        return files;
      }
      totalBytes += r.bytes;
      files[r.path] = { content: r.content, language: languageFromPath(r.path) };
    }
  }

  if (skipped > 0 || wanted.length > selected.length) {
    console.info(`[clone] ${owner}/${repo}: imported ${Object.keys(files).length}, skipped ${skipped + (wanted.length - selected.length)}`);
  }

  return files;
}

function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    txt: 'plaintext',
  };
  return langMap[ext] || 'plaintext';
}
