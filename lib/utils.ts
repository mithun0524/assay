import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    css: 'css',
    html: 'html',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'shell',
    env: 'plaintext',
    txt: 'plaintext',
  };
  return map[ext] ?? 'plaintext';
}

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
};

export function buildFileTree(files: Record<string, { content: string; language: string }>): TreeNode[] {
  const root: Record<string, unknown> = {};

  for (const path of Object.keys(files)) {
    const parts = path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = path; // leaf = full path string
  }

  function toNodes(obj: Record<string, unknown>, prefix: string): TreeNode[] {
    return Object.entries(obj)
      .map(([name, val]) => {
        const path = prefix ? `${prefix}/${name}` : name;
        if (typeof val === 'string') {
          return { name, path: val, type: 'file' as const };
        }
        return {
          name,
          path,
          type: 'directory' as const,
          children: toNodes(val as Record<string, unknown>, path),
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  return toNodes(root, '');
}