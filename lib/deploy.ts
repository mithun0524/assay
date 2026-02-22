/**
 * Deployment types and utilities for one-click Vercel deployment.
 */

import type { FileEntry } from './store';

export type DeploymentStatus = 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';

export type DeploymentResult = {
  id: string;
  url: string;
  readyState: DeploymentStatus;
  projectId: string;
  error?: string;
};

export type FrameworkType = 'nextjs' | 'vite' | 'create-react-app' | null;

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '.cache',
  '.turbo',
  '.vercel',
  'coverage',
]);

const EXCLUDED_FILES = new Set([
  '.DS_Store',
  'Thumbs.db',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
]);

/**
 * Filter files to only those suitable for deployment.
 * Strips node_modules, .next, .git, dist, build, .cache, .env*, etc.
 * Keeps package-lock.json and all source/config files.
 */
export function filterDeployableFiles(
  files: Record<string, FileEntry>
): Record<string, FileEntry> {
  const result: Record<string, FileEntry> = {};

  for (const [path, entry] of Object.entries(files)) {
    const parts = path.split('/');

    // Skip if any directory segment is in the exclusion list
    const hasExcludedDir = parts.some((part) => EXCLUDED_DIRS.has(part));
    if (hasExcludedDir) continue;

    // Skip excluded files
    const fileName = parts[parts.length - 1];
    if (EXCLUDED_FILES.has(fileName)) continue;

    // Skip any .env* file pattern
    if (fileName.startsWith('.env')) continue;

    result[path] = entry;
  }

  return result;
}

/**
 * Detect the framework from package.json dependencies.
 */
export function detectFramework(
  files: Record<string, FileEntry>
): FrameworkType {
  const pkgFile = files['package.json'];
  if (!pkgFile) return null;

  try {
    const pkg = JSON.parse(pkgFile.content);
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    if (allDeps['next']) return 'nextjs';
    if (allDeps['vite']) return 'vite';
    if (allDeps['react-scripts']) return 'create-react-app';
  } catch {
    // Invalid package.json
  }

  return null;
}

/**
 * Sanitize a project name for Vercel.
 * Lowercase, replace non-alphanumeric with hyphens, max 52 chars.
 */
export function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52);
}
