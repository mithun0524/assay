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

  // What makes this a web app is that someone wrote application code, not that
  // a config file survived. Keying the entry-point checks off "looks like Vite"
  // was backwards: it needed package.json or vite.config to be present before
  // it would complain about anything missing, so the one case it stayed silent
  // on was a project missing the whole scaffold — three components, no
  // package.json, no index.html, nothing to run. Observed exactly that.
  const hasAppCode = paths.some((p) => /^src\/.+\.(tsx|jsx|ts|js)$/.test(p) || /^(App|main|index)\.(tsx|jsx)$/.test(p));

  if (hasAppCode) {
    if (!has('index.html')) {
      issues.push({
        source: 'build',
        message:
          'There is no index.html in the project root. Vite uses it as the entry point, so ' +
          'the dev server has nothing to serve and the preview is a blank white page. Create ' +
          'index.html at the root with <div id="root"></div> and ' +
          '<script type="module" src="/src/main.tsx"></script>.',
      });
    }

    if (!has('package.json')) {
      issues.push({
        source: 'build',
        message:
          'There is no package.json, so nothing can be installed and there is no dev script to ' +
          'run. Create it with react, react-dom, vite and @vitejs/plugin-react, and a ' +
          '"dev": "vite --host" script.',
      });
    }

    const ENTRIES = ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx', 'main.tsx', 'main.jsx'];
    if (!ENTRIES.some(has)) {
      issues.push({
        source: 'build',
        message:
          'There is no entry file (src/main.tsx) that mounts React into #root, so nothing ever ' +
          'renders even once index.html loads.',
      });
    }
  }

  // Tailwind that was configured but never installed produces a page with every
  // class silently doing nothing — styled in the source, unstyled on screen.
  const pkgRaw = files['package.json']?.content ?? '';
  if ((has('tailwind.config.js') || has('tailwind.config.ts')) && !/tailwindcss/.test(pkgRaw)) {
    issues.push({
      source: 'build',
      message:
        'tailwind.config exists but tailwindcss is not in package.json, so no Tailwind class ' +
        'will have any effect. Install tailwindcss, postcss and autoprefixer, add postcss.config.js, ' +
        'and put the @tailwind directives in the stylesheet.',
    });
  }

  // index.html that never loads the app is the same blank page with an extra
  // step, so check it actually mounts something.
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

  // A stylesheet nobody imports is the quietest failure of all: the app mounts,
  // every element is on screen, and not one class does anything — browser
  // default serif on a white page. Observed with a generated todo list whose
  // App.tsx carried nine Tailwind classes, whose index.css held the @tailwind
  // directives, and whose main.tsx imported neither.
  const stylesheets = paths.filter((p) => p.endsWith('.css'));
  if (stylesheets.length > 0) {
    const allCode = paths
      .filter((p) => CODE.test(p))
      .map((p) => files[p].content)
      .join('\n');
    for (const sheet of stylesheets) {
      const name = sheet.split('/').pop()!;
      // Matched by filename: the importer may reach it by any relative route.
      if (!new RegExp(`['"][^'"]*${name.replace('.', '\\.')}['"]`).test(allCode)) {
        issues.push({
          source: 'build',
          message:
            `${sheet} is never imported by any file, so it is not bundled and none of its ` +
            `styles apply — the page renders unstyled. Import it from the entry: ` +
            `import './${name}'; in src/main.tsx.`,
        });
      }
    }
  }

  // createRoot moved to react-dom/client in React 18. From 'react-dom' it warns
  // and still works on 18, and simply does not exist on 19.
  for (const path of paths) {
    if (!CODE.test(path)) continue;
    const src = files[path].content;
    if (/createRoot/.test(src) && /from\s*['"]react-dom['"]/.test(src)) {
      issues.push({
        source: 'build',
        message: `${path} imports createRoot from "react-dom". It lives in "react-dom/client" — import ReactDOM from 'react-dom/client'.`,
      });
    }
  }

  // Imports that point at files nobody wrote. This is the App.css case: the
  // stylesheet was written as src/index.css and imported as './App.css'.
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
