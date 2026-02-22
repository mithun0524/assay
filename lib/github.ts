/**
 * GitHub API client using Octokit
 */

import { Octokit } from '@octokit/rest';
import { FileEntry } from './store';
import { getGitHubToken } from './githubAuth';

/**
 * Get authenticated Octokit instance
 */
function getOctokit(token?: string): Octokit {
  const authToken = token || getGitHubToken();
  if (!authToken) {
    throw new Error('GitHub token not found. Please authenticate first.');
  }

  return new Octokit({
    auth: authToken,
  });
}

/**
 * Get authenticated user info
 */
export async function getGitHubUser(token?: string) {
  const octokit = getOctokit(token);
  const { data } = await octokit.rest.users.getAuthenticated();
  return {
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
    email: data.email,
  };
}

/**
 * List user's repositories
 */
export async function listRepositories(options?: {
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  per_page?: number;
}): Promise<
  Array<{
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    private: boolean;
    updated_at: string | null;
  }>
> {
  const octokit = getOctokit();
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

/**
 * Create a new repository
 */
export async function createRepository(
  name: string,
  description: string,
  isPrivate: boolean = false
): Promise<{
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
}> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name,
    description,
    private: isPrivate,
    auto_init: false, // Don't initialize with README, we'll push our files
  });

  return {
    name: data.name,
    full_name: data.full_name,
    html_url: data.html_url,
    clone_url: data.clone_url,
  };
}

/**
 * Push files to a repository
 * This creates a new commit with all provided files
 */
export async function pushToRepository(
  owner: string,
  repo: string,
  files: Record<string, FileEntry>,
  commitMessage: string,
  branch: string = 'main'
): Promise<void> {
  const octokit = getOctokit();

  try {
    // Get the current commit SHA of the branch
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const currentCommitSha = refData.object.sha;

    // Get the tree SHA of the current commit
    const { data: commitData } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: currentCommitSha,
    });
    const currentTreeSha = commitData.tree.sha;

    // Create blobs for all files
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

    // Create a new tree with all files
    const { data: treeData } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: currentTreeSha,
      tree: blobs,
    });

    // Create a new commit
    const { data: newCommitData } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: treeData.sha,
      parents: [currentCommitSha],
    });

    // Update the reference to point to the new commit
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommitData.sha,
    });
  } catch (error: any) {
    // If branch doesn't exist, create it
    if (error.status === 404 && error.message.includes('Reference does not exist')) {
      // Create blobs for all files
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

      // Create a new tree
      const { data: treeData } = await octokit.rest.git.createTree({
        owner,
        repo,
        tree: blobs,
      });

      // Create the initial commit
      const { data: commitData } = await octokit.rest.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: treeData.sha,
        parents: [],
      });

      // Create the branch reference
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: commitData.sha,
      });
    } else {
      throw error;
    }
  }
}

/**
 * Clone a repository (get all files)
 */
export async function cloneRepository(
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<Record<string, FileEntry>> {
  const octokit = getOctokit();

  // Get the tree recursively
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

  // Filter for files only (not directories) and fetch their content
  const files: Record<string, FileEntry> = {};

  for (const item of treeData.tree) {
    if (item.type === 'blob' && item.sha && item.path) {
      try {
        const { data: blobData } = await octokit.rest.git.getBlob({
          owner,
          repo,
          file_sha: item.sha,
        });

        // Decode base64 content
        const content = Buffer.from(blobData.content, 'base64').toString('utf-8');

        // Determine language from file extension
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

/**
 * Parse GitHub URL to extract owner and repo
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+)/,
    /github\.com\/([^\/]+)\/([^\/\.]+)\.git/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', ''),
      };
    }
  }

  return null;
}
