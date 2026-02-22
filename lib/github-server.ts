/**
 * Server-side GitHub operations using Octokit.
 * Reads the GitHub token from the user_secrets table — never exposed to the browser.
 */

import { Octokit } from '@octokit/rest';
import { createClient } from '@/lib/supabase/server';
import type { FileEntry } from './store';

/**
 * Get an authenticated Octokit instance for the current user.
 * Reads the stored GitHub token from the database.
 */
export async function getAuthenticatedOctokit(): Promise<Octokit> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: secrets, error } = await supabase
    .from('user_secrets')
    .select('github_token')
    .eq('user_id', user.id)
    .single();

  if (error || !secrets?.github_token) {
    throw new Error('GitHub not linked. Please link your GitHub account first.');
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
  } catch (error: any) {
    // If repo already exists, return it based on the authenticated user
    if (error.status === 422) {
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
  } catch (error: any) {
    // 404 = branch doesn't exist, 409 = repo is completely empty
    if (error.status !== 404 && error.status !== 409) {
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
  branch: string = 'main'
): Promise<Record<string, FileEntry>> {
  const octokit = await getAuthenticatedOctokit();

  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
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

  for (const item of treeData.tree) {
    if (item.type === 'blob' && item.sha && item.path) {
      try {
        const { data: blobData } = await octokit.rest.git.getBlob({
          owner,
          repo,
          file_sha: item.sha,
        });

        const content = Buffer.from(blobData.content, 'base64').toString('utf-8');

        const ext = item.path.split('.').pop()?.toLowerCase() || '';
        const langMap: Record<string, string> = {
          js: 'javascript',
          jsx: 'javascript',
          ts: 'typescript',
          tsx: 'typescript',
          json: 'json',
          html: 'html',
          css: 'css',
          md: 'markdown',
          txt: 'plaintext',
        };
        const language = langMap[ext] || 'plaintext';

        files[item.path] = { content, language };
      } catch (error) {
        console.warn(`Failed to fetch blob for ${item.path}:`, error);
      }
    }
  }

  return files;
}
