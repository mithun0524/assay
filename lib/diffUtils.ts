/**
 * Diff utilities for computing file changes
 */

import DiffMatchPatch from 'diff-match-patch';

/**
 * Compute diff statistics between two strings
 */
export function getDiffStats(oldContent: string, newContent: string): {
  additions: number;
  deletions: number;
  modifications: number;
} {
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(oldContent, newContent);
  dmp.diff_cleanupSemantic(diffs);

  let additions = 0;
  let deletions = 0;

  for (const [type, text] of diffs) {
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    if (type === 1) {
      // Addition
      additions += lines.length;
    } else if (type === -1) {
      // Deletion
      deletions += lines.length;
    }
  }

  const modifications = Math.min(additions, deletions);
  additions -= modifications;
  deletions -= modifications;

  return { additions, deletions, modifications };
}

/**
 * Format diff stats as a human-readable string
 */
export function formatDiffStats(stats: ReturnType<typeof getDiffStats>): string {
  const parts: string[] = [];

  if (stats.additions > 0) {
    parts.push(`+${stats.additions}`);
  }
  if (stats.deletions > 0) {
    parts.push(`-${stats.deletions}`);
  }
  if (stats.modifications > 0) {
    parts.push(`~${stats.modifications}`);
  }

  return parts.join(' ') || 'No changes';
}

/**
 * Get file operation type
 */
export function getFileOperation(
  oldContent: string | null,
  newContent: string
): 'create' | 'modify' | 'delete' {
  if (oldContent === null) {
    return 'create';
  }
  if (newContent === '') {
    return 'delete';
  }
  return 'modify';
}
