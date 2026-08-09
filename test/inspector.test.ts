/**
 * Agent tool harness — read / list / delete, and the full inspect→edit turn.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchFiles, buildInspectionReport, hasInspection } from '../lib/agents/inspector';
import { createStreamParser, type BoltAction } from '../lib/streamParser';
import { normalizeSandboxPath } from '../lib/sandboxUtils';
import { AGENTS } from '../lib/agents';
import { VALID_ROLES } from '../lib/agents/router';
import { SYSTEM_PROMPT } from '../lib/systemPrompt';

const PROJECT = [
  'package.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/components/Button.tsx',
  'src/components/Card.tsx',
  'src/components/ui/Input.tsx',
  'src/lib/utils.ts',
  'src/index.css',
];

test('glob-lite matching', () => {
  const cases: Array<[pattern: string, expected: string[]]> = [
    ['', PROJECT.slice().sort()],
    ['**', PROJECT.slice().sort()],
    ['src/*.tsx', ['src/App.tsx', 'src/main.tsx']],
    ['src/**/*.tsx', ['src/App.tsx', 'src/components/Button.tsx', 'src/components/Card.tsx', 'src/components/ui/Input.tsx', 'src/main.tsx']],
    ['src/components/*.tsx', ['src/components/Button.tsx', 'src/components/Card.tsx']],
    ['*.json', ['package.json']],
    ['App.tsx', ['src/App.tsx']],           // bare name finds it anywhere
    ['src/lib/utils.ts', ['src/lib/utils.ts']],
    ['nope/*.ts', []],
  ];
  for (const [pattern, expected] of cases) {
    assert.deepEqual(matchFiles(PROJECT, pattern), expected, `pattern "${pattern}"`);
  }
});

test('a pathological pattern returns nothing instead of throwing', () => {
  assert.doesNotThrow(() => matchFiles(PROJECT, '['));
  assert.deepEqual(matchFiles(PROJECT, '('), []);
  assert.deepEqual(matchFiles([], '**'), []);
});

test('inspection report gives the model ground truth, including absences', () => {
  const report = buildInspectionReport({
    reads: [
      { path: 'src/App.tsx', content: 'export default function App() {}' },
      { path: 'src/Ghost.tsx', content: null },
    ],
    lists: [{ pattern: 'src/*.tsx', matches: ['src/App.tsx', 'src/main.tsx'] }],
    deletes: [{ path: 'src/Old.tsx', ok: true }, { path: 'src/Never.tsx', ok: false }],
  });

  assert.ok(report.includes('export default function App() {}'));
  assert.ok(report.includes('FILE NOT FOUND'), 'a missing file must be stated, not implied');
  assert.ok(report.includes('src/main.tsx'));
  assert.ok(report.includes('Deleted src/Old.tsx'));
  assert.ok(report.includes('Could not delete src/Never.tsx'));
  assert.ok(report.includes('Do not ask to read the same file again'));
});

test('huge files are truncated before they reach the model', () => {
  const report = buildInspectionReport({
    reads: [{ path: 'big.ts', content: 'x'.repeat(500_000) }],
    lists: [{ pattern: '**', matches: Array.from({ length: 5000 }, (_, i) => `f${i}.ts`) }],
    deletes: [],
  });
  assert.ok(report.length < 40_000, `report too large: ${report.length}`);
  assert.ok(report.includes('(truncated)'));
  assert.ok(report.includes('and 4800 more'));
});

test('deletions alone do not trigger another round trip', () => {
  assert.equal(hasInspection({ reads: [], lists: [], deletes: [{ path: 'a.ts', ok: true }] }), false);
  assert.equal(hasInspection({ reads: [{ path: 'a.ts', content: 'x' }], lists: [], deletes: [] }), true);
  assert.equal(hasInspection({ reads: [], lists: [{ pattern: '**', matches: [] }], deletes: [] }), true);
});

/* ───────────────── full inspect → edit → delete turn ───────────────── */

type Sandbox = { files: Record<string, string> };

async function turn(sandbox: Sandbox, stream: string) {
  const reads: string[] = [];
  const lists: string[] = [];
  const deletes: string[] = [];
  let wroteFiles = false;

  const parser = createStreamParser(async (a: BoltAction) => {
    if (a.type === 'file') {
      const p = normalizeSandboxPath(a.filePath);
      if (p) { sandbox.files[p] = a.content; wroteFiles = true; }
    } else if (a.type === 'read') {
      reads.push(a.filePath);
    } else if (a.type === 'list') {
      lists.push(a.pattern);
    } else if (a.type === 'delete') {
      const p = normalizeSandboxPath(a.filePath);
      deletes.push(a.filePath);
      if (p) delete sandbox.files[p];
    }
  });
  parser.feed(stream);
  await parser.flush();

  const result = {
    reads: reads.map((p) => ({ path: p, content: sandbox.files[normalizeSandboxPath(p) ?? ''] ?? null })),
    lists: lists.map((pattern) => ({ pattern, matches: matchFiles(Object.keys(sandbox.files), pattern) })),
    deletes: deletes.map((p) => ({ path: p, ok: true })),
  };
  return { result, wroteFiles, report: hasInspection(result) ? buildInspectionReport(result) : null };
}

test('end to end: agent inspects, then edits based on what it actually found', async () => {
  const sandbox: Sandbox = {
    files: {
      'src/App.tsx': 'import Old from "./Old";\nexport default () => <Old/>;',
      'src/Old.tsx': 'export default () => <div>old</div>;',
    },
  };

  // Round 1: it looks instead of guessing.
  const first = await turn(sandbox, '<boltAction type="read" filePath="src/App.tsx"></boltAction><boltAction type="list">src/**/*.tsx</boltAction>');
  assert.equal(first.wroteFiles, false, 'must not write before it has looked');
  assert.ok(first.report);
  assert.ok(first.report!.includes('import Old from "./Old"'), 'real contents reached the model');
  assert.ok(first.report!.includes('src/Old.tsx'));

  // Round 2: rename the component and clean up after itself.
  const second = await turn(
    sandbox,
    '<boltAction type="file" filePath="src/New.tsx">export default () => <div>new</div>;</boltAction>' +
      '<boltAction type="file" filePath="src/App.tsx">import New from "./New";\nexport default () => <New/>;</boltAction>' +
      '<boltAction type="delete" filePath="src/Old.tsx"></boltAction>'
  );

  assert.equal(sandbox.files['src/Old.tsx'], undefined, 'obsolete file left behind');
  assert.ok(sandbox.files['src/New.tsx']);
  assert.ok(sandbox.files['src/App.tsx'].includes('./New'));
  assert.equal(second.report, null, 'a pure edit turn should not round-trip again');
});

test('end to end: reading a file that does not exist does not invent one', async () => {
  const sandbox: Sandbox = { files: { 'src/App.tsx': 'x' } };
  const { report } = await turn(sandbox, '<boltAction type="read" filePath="src/Imaginary.tsx"></boltAction>');
  assert.ok(report!.includes('FILE NOT FOUND'));
  assert.equal(Object.keys(sandbox.files).length, 1);
});

test('delete cannot escape the project root', async () => {
  const sandbox: Sandbox = { files: { 'etc/passwd': 'x', 'src/App.tsx': 'y' } };
  await turn(sandbox, '<boltAction type="delete" filePath="../../src/App.tsx"></boltAction>');
  assert.equal(sandbox.files['src/App.tsx'], undefined, 'clamped path deletes inside the project');
  assert.equal(sandbox.files['etc/passwd'], 'x');
});

test('every agent is told about the tools it can use', () => {
  for (const capability of ['type="read"', 'type="list"', 'type="delete"', 'type="search"']) {
    assert.ok(SYSTEM_PROMPT.includes(capability), `system prompt never documents ${capability}`);
  }
  assert.ok(SYSTEM_PROMPT.includes('STOP generating immediately after emitting read or list'));

  // Each specialist should mention at least one inspection capability of its own.
  for (const role of VALID_ROLES) {
    const p = AGENTS[role].systemPrompt;
    assert.ok(
      /type="(read|list|search)"/.test(p),
      `${role} prompt never tells it to inspect or research`
    );
  }
});
