/**
 * Sandbox + QA-gate harness. Pure logic only — no WebContainer needed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeSandboxPath, detectDevCommand } from '../lib/sandboxUtils';
import { buildQaFixPrompt, summarizeQaIssues, type QaIssue } from '../lib/qaGate';
import { detectTerminalErrors, stripAnsi } from '../lib/terminalErrorDetector';
import { useStore } from '../lib/store';

test('sandbox paths stay inside the project root', () => {
  const cases: Array<[input: string, expected: string | null]> = [
    ['src/App.tsx', 'src/App.tsx'],
    ['/src/App.tsx', 'src/App.tsx'],
    ['./src/App.tsx', 'src/App.tsx'],
    ['src//App.tsx', 'src/App.tsx'],
    ['src\\App.tsx', 'src/App.tsx'],
    ['  src/App.tsx  ', 'src/App.tsx'],
    ['../../etc/passwd', 'etc/passwd'],
    ['src/../../../root/.ssh/id_rsa', 'root/.ssh/id_rsa'],
    ['..', null],
    ['/', null],
    ['', null],
    ['   ', null],
  ];
  for (const [input, expected] of cases) {
    assert.equal(normalizeSandboxPath(input), expected, `path ${JSON.stringify(input)}`);
  }
  // @ts-expect-error — models emit junk; it must not throw
  assert.equal(normalizeSandboxPath(null), null);
});

test('dev command follows the project, not a hardcoded guess', () => {
  const setPkg = (pkg: unknown) =>
    useStore.setState({
      files: pkg === null ? {} : { 'package.json': { content: JSON.stringify(pkg), language: 'json' } },
    });

  setPkg({ scripts: { dev: 'vite --host' } });
  assert.deepEqual(detectDevCommand(), { cmd: 'npm', args: ['run', 'dev'] });

  setPkg({ scripts: { start: 'react-scripts start' } });
  assert.deepEqual(detectDevCommand(), { cmd: 'npm', args: ['run', 'start'] });

  setPkg({ scripts: { serve: 'vue-cli-service serve' } });
  assert.deepEqual(detectDevCommand(), { cmd: 'npm', args: ['run', 'serve'] });

  setPkg({ dependencies: { vite: '^5' } });
  assert.deepEqual(detectDevCommand(), { cmd: 'npx', args: ['vite', '--host'] });

  // Unparseable package.json must not throw
  useStore.setState({ files: { 'package.json': { content: '{ broken', language: 'json' } } });
  assert.deepEqual(detectDevCommand(), { cmd: 'npm', args: ['run', 'dev'] });

  setPkg(null);
  assert.deepEqual(detectDevCommand(), { cmd: 'npm', args: ['run', 'dev'] });
});

test('terminal error detection ignores ANSI noise and normal output', () => {
  assert.equal(detectTerminalErrors('vite v5.0.0 ready in 300 ms\n➜ Local: http://localhost:5173/'), null);

  const ansi = '[31mError: Cannot find module \'react-router-dom\'[0m';
  assert.equal(stripAnsi(ansi), "Error: Cannot find module 'react-router-dom'");
  const found = detectTerminalErrors(ansi);
  assert.ok(found && found[0].includes('Cannot find module'));

  const ts = detectTerminalErrors('src/App.tsx(12,3): error TS2304: Cannot find name \'foo\'.');
  assert.ok(ts && ts.length > 0);
});

test('QA prompt carries every issue and stays bounded', () => {
  const issues: QaIssue[] = [
    { source: 'build', message: 'error TS2304: Cannot find name "foo"' },
    { source: 'runtime', message: 'TypeError: undefined is not a function' },
    { source: 'command', message: 'Command failed (exit 1): npm install leftpadd' },
  ];

  const prompt = buildQaFixPrompt(issues, 1, 2);
  assert.ok(prompt.includes('attempt 1/2'));
  for (const i of issues) assert.ok(prompt.includes(i.message), `missing: ${i.message}`);

  // Huge payloads get truncated rather than blowing the context window
  const huge = buildQaFixPrompt([{ source: 'build', message: 'x'.repeat(50_000) }], 2, 2);
  assert.ok(huge.length < 3000, `prompt not truncated: ${huge.length}`);
});

test('QA summary reads like a status line', () => {
  assert.equal(summarizeQaIssues([]), 'QA passed — the app builds and runs.');
  const s = summarizeQaIssues([
    { source: 'runtime', message: 'a' },
    { source: 'runtime', message: 'b' },
  ]);
  assert.ok(s.startsWith('QA found 2 runtime error'), s);
});

// ── Tool-result feedback ──
// The tools run in the browser and the stream is one-way, so a write that never
// landed is invisible to the model unless we hand it back.

// writeFileToSandbox itself can't be imported here — it pulls in
// @webcontainer/api, which has no node entry point. What it refuses is exactly
// what normalizeSandboxPath rejects, and returning null for those is the one
// line tsc already types, so pinning the refusal set is the useful half.
test('the paths a write is refused for are the unusable ones', () => {
  for (const bad of ['', '   ', '..', '/', './', '../..']) {
    assert.equal(normalizeSandboxPath(bad), null, `"${bad}" should be refused`);
  }
  assert.equal(normalizeSandboxPath('../src/App.tsx'), 'src/App.tsx', 'clamped, not refused');
});

test('tool failures reach the fix prompt and say the file is missing', () => {
  const issues: QaIssue[] = [
    { source: 'tool', message: 'write_file("../etc/x") failed: not a usable path' },
    { source: 'build', message: 'Cannot find module ./x' },
  ];
  const prompt = buildQaFixPrompt(issues, 1, 3);
  assert.match(prompt, /was NOT written/, 'the label must say the write did not land');
  assert.match(prompt, /Write it again/, 'the model must be told to re-issue the write');
  assert.match(prompt, /\.\.\/etc\/x/, 'the offending path must be quoted back');

  // Without a tool failure that instruction is noise and must not appear.
  const plain = buildQaFixPrompt([{ source: 'build', message: 'boom' }], 1, 3);
  assert.doesNotMatch(plain, /Write it again/);
});

test('a tool failure alone is enough to fail QA', async () => {
  const { runQaCheck } = await import('../lib/qaGate');
  const failure: QaIssue = { source: 'tool', message: 'write_file("a.tsx") failed: disk on fire' };
  const issues = await runQaCheck(undefined, [failure]);
  assert.ok(issues.length >= 1, 'a clean sandbox must still report the failed write');
  assert.equal(issues[0].source, 'tool', 'the root cause must lead the list');
  assert.match(summarizeQaIssues(issues), /tool call failed/i);
});

// ── Reading a 429 ──
// Three different failures answer with 429 and only two of them are fixed by
// waiting. The client used to print "wait 60 seconds" for all three.

test('a 429 with no Retry-After shows the reason and does not lock the composer', async () => {
  const { interpretRateLimit } = await import('../lib/rateLimit');
  const daily = "You've used up today's free OpenRouter requests. The allowance resets at 00:00 UTC.";
  const v = interpretRateLimit(null, daily);
  assert.equal(v.lockMs, 0, 'waiting cannot fix a daily allowance — do not disable the composer');
  assert.equal(v.message, daily, "the server's explanation must survive to the user");
});

test('a 429 with Retry-After locks for exactly that long', async () => {
  const { interpretRateLimit } = await import('../lib/rateLimit');
  assert.equal(interpretRateLimit('15', 'Every free model is busy right now.').lockMs, 15_000);
  assert.equal(interpretRateLimit('60', 'Too many requests.').lockMs, 60_000);
});

test('a malformed Retry-After cannot brick the composer', async () => {
  const { interpretRateLimit } = await import('../lib/rateLimit');
  for (const bad of ['', 'soon', '-5', '0', 'NaN']) {
    assert.equal(interpretRateLimit(bad, 'x').lockMs, 0, `"${bad}" should not lock`);
  }
  // An absurd value is clamped rather than trusted.
  assert.equal(interpretRateLimit('99999', 'x').lockMs, 300_000);
  // And there is always something to show.
  assert.ok(interpretRateLimit(null, '').message.length > 0);
});

// ── Structural faults ──
// A blank page that prints no error passes every output-based check, so these
// read the files instead. Reproduced from a real generated todo list.

const TODO_APP = {
  'package.json': { content: '{"scripts":{"dev":"vite --host"},"devDependencies":{"vite":"^3.1.0"}}' },
  'vite.config.ts': { content: "import { defineConfig } from 'vite';" },
  'src/App.tsx': { content: "import React from 'react';\nimport './App.css';\nexport default function App(){return <div/>}" },
  'src/index.css': { content: 'body { font-family: Arial; }' },
  'src/main.tsx': { content: "import App from './App';\ncreateRoot(document.getElementById('root')!).render(<App/>)" },
};

test('a project with no index.html is reported, not passed', async () => {
  const { checkProjectStructure } = await import('../lib/projectCheck');
  const issues = checkProjectStructure(TODO_APP);
  assert.ok(
    issues.some((i) => /index\.html/.test(i.message)),
    'the missing Vite entry point is the whole reason the page was blank',
  );
});

test('an import of a file nobody wrote is reported', async () => {
  const { checkProjectStructure } = await import('../lib/projectCheck');
  const issues = checkProjectStructure(TODO_APP);
  assert.ok(
    issues.some((i) => i.message.includes('./App.css')),
    'App.tsx imported ./App.css while the stylesheet was written as src/index.css',
  );
});

test('a correct project reports nothing', async () => {
  const { checkProjectStructure } = await import('../lib/projectCheck');
  const ok = {
    'package.json': { content: '{"devDependencies":{"vite":"^5"}}' },
    'index.html': { content: '<div id="root"></div><script type="module" src="/src/main.tsx"></script>' },
    'src/main.tsx': { content: "import App from './App';\nimport './index.css';\ndocument.getElementById('root')" },
    'src/App.tsx': { content: "import { Item } from './components/Item';\nexport default function App(){return <Item/>}" },
    'src/components/Item.tsx': { content: 'export function Item(){return <li/>}' },
    'src/index.css': { content: 'body{}' },
  };
  assert.deepEqual(checkProjectStructure(ok), [], 'a working project must not be flagged');
});

test('extensionless and index imports resolve like a bundler', async () => {
  const { checkProjectStructure } = await import('../lib/projectCheck');
  const files = {
    'package.json': { content: '{"devDependencies":{"vite":"^5"}}' },
    'index.html': { content: '<div id="root"></div><script type="module" src="/src/main.tsx"></script>' },
    // './hooks' → src/hooks/index.ts, and '../util' climbs a directory.
    'src/main.tsx': { content: "import './hooks';\nimport '../util';" },
    'src/hooks/index.ts': { content: 'export {}' },
    'util.ts': { content: 'export {}' },
  };
  assert.deepEqual(checkProjectStructure(files), []);
});

test('a project missing the whole scaffold is reported, not ignored', async () => {
  const { checkProjectStructure } = await import('../lib/projectCheck');
  // Observed from a real "pomodoro timer" build: three files, finishReason
  // 'stop', no package.json and no entry point. The first version of this
  // check needed a package.json before it would notice a missing package.json.
  const partial = {
    'src/components/PomodoroTimer.tsx': { content: 'export function T(){return <div/>}' },
    'src/App.tsx': { content: "import { T } from './components/PomodoroTimer';\nexport default function App(){return <T/>}" },
    'tailwind.config.js': { content: 'module.exports = { content: [] }' },
  };
  const issues = checkProjectStructure(partial);
  const all = issues.map((i) => i.message).join(' | ');
  assert.match(all, /index\.html/, 'no entry point to serve');
  assert.match(all, /package\.json/, 'nothing to install or run');
  assert.match(all, /src\/main\.tsx/, 'nothing mounts React');
  assert.match(all, /tailwindcss is not in package\.json/, 'configured but never installed');
});

test('a project with no app code at all is left alone', async () => {
  const { checkProjectStructure } = await import('../lib/projectCheck');
  // A README-only or empty project is not a broken web app, and must not be
  // nagged about a missing index.html it has no use for.
  assert.deepEqual(checkProjectStructure({ 'README.md': { content: '# hi' } }), []);
  assert.deepEqual(checkProjectStructure({}), []);
});

test('a stylesheet nobody imports is reported', async () => {
  const { checkProjectStructure } = await import('../lib/projectCheck');
  // Observed: nine Tailwind classes in App.tsx, @tailwind directives in
  // index.css, and no import anywhere. The app mounts and renders unstyled.
  const unstyled = {
    'package.json': { content: '{"devDependencies":{"vite":"^5"},"dependencies":{"tailwindcss":"^3"}}' },
    'index.html': { content: '<div id="root"></div><script type="module" src="/src/main.tsx"></script>' },
    'src/main.tsx': { content: "import App from './App';\ncreateRoot(document.getElementById('root'))" },
    'src/App.tsx': { content: 'export default function App(){return <div className="p-4"/>}' },
    'src/index.css': { content: '@tailwind base;' },
  };
  assert.match(
    checkProjectStructure(unstyled).map((i) => i.message).join(' | '),
    /index\.css is never imported/,
  );

  // …and importing it clears the finding.
  const styled = { ...unstyled, 'src/main.tsx': { content: "import './index.css';\nimport App from './App';" } };
  assert.deepEqual(checkProjectStructure(styled), []);
});

test('createRoot from the wrong package is reported', async () => {
  const { checkProjectStructure } = await import('../lib/projectCheck');
  const files = {
    'package.json': { content: '{"devDependencies":{"vite":"^5"}}' },
    'index.html': { content: '<div id="root"></div><script type="module" src="/src/main.tsx"></script>' },
    'src/main.tsx': { content: "import ReactDOM from 'react-dom';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root'))" },
    'src/index.css': { content: 'body{}' },
  };
  assert.match(checkProjectStructure(files).map((i) => i.message).join(' | '), /react-dom\/client/);
});
