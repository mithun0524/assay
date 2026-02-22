/**
 * Server-side Vercel API operations.
 * Reads the Vercel token from the user_secrets table — never exposed to the browser.
 */

import { createClient } from '@/lib/supabase/server';
import type { FileEntry } from './store';
import {
  filterDeployableFiles,
  type DeploymentResult,
  type DeploymentStatus,
  type FrameworkType,
} from './deploy';

/**
 * Get the stored Vercel token for the current authenticated user.
 */
export async function getVercelToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: secrets } = await supabase
    .from('user_secrets')
    .select('vercel_token')
    .eq('user_id', user.id)
    .single();

  return secrets?.vercel_token || null;
}

/**
 * Save a Vercel token for the current authenticated user.
 */
export async function saveVercelToken(token: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase.from('user_secrets').upsert(
    {
      user_id: user.id,
      vercel_token: token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw new Error(error.message);
}

/**
 * Save a Vercel project ID for redeployment.
 */
export async function saveVercelProjectId(projectId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase.from('user_secrets').upsert(
    {
      user_id: user.id,
      vercel_project_id: projectId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) console.error('Failed to save Vercel project ID:', error.message);
}

/**
 * Get the stored Vercel project ID for redeployment.
 */
export async function getVercelProjectId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: secrets } = await supabase
    .from('user_secrets')
    .select('vercel_project_id')
    .eq('user_id', user.id)
    .single();

  return secrets?.vercel_project_id || null;
}

/**
 * Create a deployment on Vercel using the REST API.
 */
export async function createDeployment(
  files: Record<string, FileEntry>,
  projectName: string,
  framework: FrameworkType,
  token: string,
  existingProjectId?: string
): Promise<DeploymentResult> {
  const deployableFiles = filterDeployableFiles(files);

  // Build the files array for the Vercel API
  const vercelFiles = Object.entries(deployableFiles).map(([path, entry]) => ({
    file: path,
    data: Buffer.from(entry.content).toString('base64'),
    encoding: 'base64' as const,
  }));

  // Build the deployment payload
  const payload: Record<string, unknown> = {
    name: projectName,
    files: vercelFiles,
    projectSettings: {
      framework: framework || undefined,
    },
  };

  if (existingProjectId) {
    payload.project = existingProjectId;
  }

  const response = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData.error?.message || errorData.message || `Vercel API error (${response.status})`;
    throw new Error(message);
  }

  const data = await response.json();

  return {
    id: data.id,
    url: data.url,
    readyState: data.readyState as DeploymentStatus,
    projectId: data.projectId,
  };
}

/**
 * Check the status of an existing Vercel deployment.
 */
export async function getDeploymentStatus(
  deploymentId: string,
  token: string
): Promise<{ readyState: DeploymentStatus; url: string; error?: string }> {
  const response = await fetch(
    `https://api.vercel.com/v13/deployments/${deploymentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Failed to check deployment status (${response.status})`
    );
  }

  const data = await response.json();

  return {
    readyState: data.readyState as DeploymentStatus,
    url: data.url,
    error: data.errorMessage || undefined,
  };
}
