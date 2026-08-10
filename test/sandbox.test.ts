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
