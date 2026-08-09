/**
 * Pure sandbox helpers — no WebContainer import, so they stay unit-testable.
 */

import { useStore } from './store';

/**
 * Normalise a model-supplied path into a project-relative one.
 * Models regularly emit "/src/App.jsx", "./src/App.jsx" or even "../../etc/x";
 * all of those must land inside the project root.
 */
export function normalizeSandboxPath(filePath: string): string | null {
  if (typeof filePath !== 'string') return null;
  const cleaned = filePath.trim().replace(/\\/g, '/');
  if (!cleaned) return null;

  const parts: string[] = [];
  for (const segment of cleaned.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      parts.pop(); // clamp at the root instead of escaping it
      continue;
    }
    parts.push(segment);
  }

  const path = parts.join('/');
  return path.length > 0 ? path : null;
}

/** Parsed package.json from the store, or null when the project has none. */
export function readPackageJson(): { scripts?: Record<string, string>; dependencies?: Record<string, string> } | null {
  const raw = useStore.getState().files['package.json']?.content;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Pick the command that actually starts this project's dev server instead of
 * assuming `npm run dev` — plenty of templates only define `start` or use vite.
 */
export function detectDevCommand(): { cmd: string; args: string[] } {
  const pkg = readPackageJson();
  const scripts = pkg?.scripts ?? {};
  if (scripts.dev) return { cmd: 'npm', args: ['run', 'dev'] };
  if (scripts.start) return { cmd: 'npm', args: ['run', 'start'] };
  if (scripts.serve) return { cmd: 'npm', args: ['run', 'serve'] };
  if (pkg?.dependencies?.vite || pkg?.dependencies?.['@vitejs/plugin-react']) {
    return { cmd: 'npx', args: ['vite', '--host'] };
  }
  return { cmd: 'npm', args: ['run', 'dev'] };
}
