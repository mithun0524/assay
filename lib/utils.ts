import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type TreeNode = {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
};

/**
 * Build a tree of TreeNode from a flat record of file paths (keys) to file entries.
 */
export function buildFileTree(files: Record<string, unknown>): TreeNode[] {
  const byPath = new Map<string, TreeNode>();

  for (const filePath of Object.keys(files)) {
    const parts = filePath.split('/');
    for (let i = 0; i < parts.length; i++) {
      const path = parts.slice(0, i + 1).join('/');
      const name = parts[i];
      if (!byPath.has(path)) {
        byPath.set(path, {
          path,
          name,
          type: i === parts.length - 1 ? 'file' : 'directory',
          children: i === parts.length - 1 ? undefined : [],
        });
      }
    }
  }

  for (const node of byPath.values()) {
    if (node.type === 'directory') {
      node.children = [...byPath.values()].filter(
        (n) => n.path.startsWith(node.path + '/') && n.path.indexOf('/', node.path.length + 1) === -1
      );
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    }
  }

  const rootNodes = [...byPath.values()].filter((n) => !n.path.includes('/'));
  rootNodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return rootNodes;
}

/**
 * Get language identifier from file path (extension-based).
 */
export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
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
  return langMap[ext || ''] || 'plaintext';
}
