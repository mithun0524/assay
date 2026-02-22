/**
 * Client-side fetch wrappers for the Vercel deploy API routes.
 * All auth is handled server-side via the user's stored Vercel token.
 */

import type { FileEntry } from './store';
import type { DeploymentResult, DeploymentStatus, FrameworkType } from './deploy';

/**
 * Save a Vercel token to the database (authenticated users).
 */
export async function saveVercelToken(token: string): Promise<void> {
  const res = await fetch('/api/deploy/token', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save Vercel token');
  }
}

/**
 * Check if the authenticated user has a Vercel token stored.
 */
export async function checkVercelToken(): Promise<{
  hasToken: boolean;
  projectId: string | null;
}> {
  const res = await fetch('/api/deploy/token');
  if (!res.ok) {
    return { hasToken: false, projectId: null };
  }
  return res.json();
}

/**
 * Deploy files to Vercel via our API proxy.
 */
export async function deployToVercel(
  files: Record<string, FileEntry>,
  projectName: string,
  framework: FrameworkType,
  options?: { projectId?: string }
): Promise<DeploymentResult> {
  const res = await fetch('/api/deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      files,
      projectName,
      framework,
      projectId: options?.projectId,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Deployment failed (${res.status})`);
  }

  return res.json() as Promise<DeploymentResult>;
}

/**
 * Check the status of a Vercel deployment.
 */
export async function checkDeploymentStatus(
  deploymentId: string
): Promise<{ readyState: DeploymentStatus; url: string; error?: string }> {
  const params = new URLSearchParams({ id: deploymentId });

  const res = await fetch(`/api/deploy/status?${params}`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to check deployment status (${res.status})`);
  }

  return res.json();
}
