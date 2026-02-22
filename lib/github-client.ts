/**
 * Client-side fetch wrappers for the GitHub proxy API routes.
 * These never touch tokens — all auth is handled server-side.
 */

import type { FileEntry } from './store';

/**
 * Parse a GitHub URL to extract owner and repo.
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+)/,
    /github\.com\/([^\/]+)\/([^\/\.]+)\.git/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2].replace('.git', '') };
    }
  }
  return null;
}

export async function fetchGitHubUser() {
  const res = await fetch('/api/github/user');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch GitHub user (${res.status})`);
  }
  return res.json() as Promise<{
    login: string;
    name: string | null;
    avatar_url: string;
    email: string | null;
  }>;
}

export async function fetchRepositories(options?: {
  sort?: string;
  per_page?: number;
}) {
  const params = new URLSearchParams();
  if (options?.sort) params.set('sort', options.sort);
  if (options?.per_page) params.set('per_page', String(options.per_page));

  const res = await fetch(`/api/github/repos?${params}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch repositories (${res.status})`);
  }
  return res.json() as Promise<
    Array<{
      name: string;
      full_name: string;
      description: string | null;
      html_url: string;
      private: boolean;
      updated_at: string | null;
    }>
  >;
}

export async function createRepo(
  name: string,
  description: string,
  isPrivate: boolean = false
) {
  const res = await fetch('/api/github/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, isPrivate }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to create repository (${res.status})`);
  }
  return res.json() as Promise<{
    name: string;
    full_name: string;
    html_url: string;
    clone_url: string;
  }>;
}

export async function pushToRepo(
  owner: string,
  repo: string,
  files: Record<string, FileEntry>,
  commitMessage: string,
  branch: string = 'main'
) {
  const res = await fetch('/api/github/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, files, commitMessage, branch }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to push to repository (${res.status})`);
  }
  return res.json();
}

export async function cloneRepo(
  owner: string,
  repo: string,
  branch: string = 'main'
) {
  const res = await fetch('/api/github/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, branch }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to clone repository (${res.status})`);
  }
  return res.json() as Promise<Record<string, FileEntry>>;
}
