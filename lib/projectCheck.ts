/**
 * Structural faults that produce a blank page and no error.
 *
 * The QA gate reads terminal output, runtime errors and sandbox status, which
 * between them catch a build that fails loudly. They caught nothing for a todo
 * list that shipped with no index.html: Vite had no entry to serve, the page
 * was white, nothing was printed to the terminal, the dev server was up and the
 * preview URL resolved — so QA reported "the app builds and runs" over a blank
 * screen.
 *
 * These checks are static and deterministic. They read the files the agent
 * wrote and answer one question: could this ever have rendered?
 */

import type { QaIssue } from './qaGate';

type Files = Record<string, { content: string }>;

const CODE = /\.(tsx?|jsx?|mjs)$/;
/** Extensions a bare relative import may be resolved with, in Vite's order. */
const TRIED = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css'];
const INDEXES = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

/** Resolve "./x" against the importing file, the way a bundler would. */
function resolveRelative(fromPath: string, spec: string): string {
  const base = fromPath.split('/').slice(0, -1);
  for (const part of spec.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') base.pop();
    else base.push(part);
  }
  return base.join('/');
}

/** Every relative specifier a file imports, including side-effect imports. */
function relativeImports(source: string): string[] {
  const out: string[] = [];
  // `from './x'`, `import './x'`, and `require('./x')` all count.
  const re = /(?:from\s*|import\s*|require\s*\(\s*)['"](\.[^'"]*)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push(m[1]);
  return out;
}

export function checkProjectStructure(files: Files): QaIssue[] {
  const paths = Object.keys(files);
  if (paths.length === 0) return [];

  const issues: QaIssue[] = [];
  const has = (p: string) => Object.prototype.hasOwnProperty.call(files, p);

  const pkgRaw = files['package.json']?.content ?? '';
  const looksLikeVite = /"vite"\s*:/.test(pkgRaw) || /vite/.test(pkgRaw) || has('vite.config.ts') || has('vite.config.js');

  // 1. The entry point. Vite serves index.html from the project root and has
  //    nothing to do without it — no error, just an empty response.
  if (looksLikeVite && !has('index.html')) {
    issues.push({
      source: 'build',
      message:
        'There is no index.html in the project root. Vite uses it as the entry point, so ' +
        'the dev server has nothing to serve and the preview is a blank white page. Create ' +
        'index.html at the root with <div id="root"></div> and ' +
        '<script type="module" src="/src/main.tsx"></script>.',
    });
  }

  // 2. index.html that never loads the app is the same blank page with an extra
  //    step, so check it actually mounts something.
  const html = files['index.html']?.content;
  if (html) {
    if (!/<script[^>]+type=["']module["']/.test(html)) {
      issues.push({
        source: 'build',
        message: 'index.html does not load a module script, so the React app is never started.',
      });
    }
    if (!/id=["']root["']/.test(html) && /getElementById\(['"]root['"]\)/.test(
      (files['src/main.tsx'] ?? files['src/main.jsx'] ?? files['main.tsx'] ?? { content: '' }).content,
    )) {
      issues.push({
        source: 'build',
        message:
          'The entry calls getElementById("root") but index.html has no element with id="root", ' +
          'so React has nothing to mount into and the page stays blank.',
      });
    }
  }

  // 3. Imports that point at files nobody wrote. This is the App.css case: the
  //    stylesheet was written as src/index.css and imported as './App.css'.
  for (const path of paths) {
    if (!CODE.test(path)) continue;
    for (const spec of relativeImports(files[path].content)) {
      const target = resolveRelative(path, spec);
      const found =
        TRIED.some((ext) => has(target + ext)) || INDEXES.some((idx) => has(target + idx));
      if (!found) {
        issues.push({
          source: 'build',
          message: `${path} imports "${spec}", which does not exist in the project. Create it, or change the import to the file that was actually written.`,
        });
      }
    }
  }

  return issues;
}
