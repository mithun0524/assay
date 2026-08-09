/**
 * Stream parser harness — the piece that turns model output into file writes.
 * Anything wrong here silently loses the user's code, so it gets the ugly inputs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createStreamParser, stripActions, type BoltAction } from '../lib/streamParser';

function collect() {
  const actions: BoltAction[] = [];
  const parser = createStreamParser((a) => {
    actions.push(a);
  });
  return { actions, parser };
}

const FILE = (path: string, body: string) =>
  `<boltAction type="file" filePath="${path}">${body}</boltAction>`;

test('parses files, shells and start commands', async () => {
  const { actions, parser } = collect();
  parser.feed(
    `blah ${FILE('src/App.jsx', 'export default () => <div/>;')}` +
      `<boltAction type="shell">npm install</boltAction>` +
      `<boltAction type="start">npm run dev</boltAction>` +
      `<boltAction type="search">react router v7</boltAction>`
  );
  await parser.flush();

  assert.deepEqual(actions, [
    { type: 'file', filePath: 'src/App.jsx', content: 'export default () => <div/>;' },
    { type: 'shell', command: 'npm install' },
    { type: 'start', command: 'npm run dev' },
    { type: 'search', query: 'react router v7' },
  ]);
});

test('survives chunking at every single byte boundary', async () => {
  const stream = `intro text ${FILE('a.ts', 'const a = 1;\n</not-a-close>')}tail ${FILE('b.ts', 'const b = 2;')}`;

  for (let size = 1; size <= 7; size++) {
    const { actions, parser } = collect();
    for (let i = 0; i < stream.length; i += size) {
      parser.feed(stream.slice(i, i + size));
    }
    await parser.flush();
    assert.deepEqual(
      actions.map((a) => (a.type === 'file' ? [a.filePath, a.content] : a.type)),
      [
        ['a.ts', 'const a = 1;\n</not-a-close>'],
        ['b.ts', 'const b = 2;'],
      ],
      `chunk size ${size}`
    );
  }
});

test('awaits async handlers in order and before flush resolves', async () => {
  const done: string[] = [];
  const parser = createStreamParser(async (action) => {
    // Files deliberately slower than shells — order must still hold.
    await new Promise((r) => setTimeout(r, action.type === 'file' ? 20 : 0));
    done.push(
      action.type === 'file' ? action.filePath
      : action.type === 'search' ? action.query
      : action.type === 'shell' || action.type === 'start' ? action.command
      : action.type
    );
  });

  parser.feed(FILE('one.ts', '1') + FILE('two.ts', '2') + '<boltAction type="shell">npm i</boltAction>');
  await parser.flush();

  assert.deepEqual(done, ['one.ts', 'two.ts', 'npm i'], 'shell ran before the file writes finished');
});

test('a failing handler does not kill the rest of the stream', async () => {
  const seen: string[] = [];
  const parser = createStreamParser(async (action) => {
    if (action.type === 'file' && action.filePath === 'bad.ts') throw new Error('disk full');
    seen.push(action.type);
  });
  parser.feed(FILE('bad.ts', 'x') + FILE('good.ts', 'y') + '<boltAction type="start">npm run dev</boltAction>');
  await assert.doesNotReject(parser.flush());
  assert.deepEqual(seen, ['file', 'start']);
});

test('handles malformed and hostile output', async () => {
  const cases: Array<[label: string, input: string, expected: number]> = [
    ['unclosed tag emits on flush', '<boltAction type="file" filePath="x.ts">half written', 1],
    ['missing type attribute', '<boltAction filePath="x.ts">body</boltAction>', 0],
    ['missing filePath', '<boltAction type="file">body</boltAction>', 0],
    ['empty attrs', '<boltAction>body</boltAction>', 0],
    ['no tags at all', 'just prose about <boltActionable> things', 0],
    ['nested-looking content', FILE('x.ts', 'const s = "<boltAction type=\\"file\\">";'), 1],
    ['single-quoted attrs', "<boltAction type='file' filePath='q.ts'>ok</boltAction>", 1],
    ['empty file body', FILE('empty.ts', ''), 1],
  ];

  for (const [label, input, expected] of cases) {
    const { actions, parser } = collect();
    parser.feed(input);
    await parser.flush();
    assert.equal(actions.length, expected, `${label}: got ${JSON.stringify(actions)}`);
  }
});

test('handles a large burst of actions in one chunk', async () => {
  const { actions, parser } = collect();
  const many = Array.from({ length: 600 }, (_, i) => FILE(`f${i}.ts`, `export const n = ${i};`)).join('');
  parser.feed(many);
  await parser.flush();
  assert.equal(actions.length, 600, 'actions dropped in a single large chunk');
  assert.equal((actions[599] as { filePath: string }).filePath, 'f599.ts');
});

test('parser is reusable after flush', async () => {
  const { actions, parser } = collect();
  parser.feed('<boltAction type="file" filePath="a.ts">partial');
  await parser.flush();
  parser.feed(FILE('b.ts', 'clean'));
  await parser.flush();
  assert.deepEqual(actions.map((a) => (a as { filePath?: string }).filePath), ['a.ts', 'b.ts']);
});

test('stripActions removes action blocks from display text', () => {
  const text = `Here you go:\n${FILE('a.ts', 'x')}\n\n\n\nDone.`;
  const stripped = stripActions(text);
  assert.ok(!stripped.includes('boltAction'));
  assert.ok(stripped.startsWith('Here you go:'));
  assert.ok(stripped.endsWith('Done.'));
  assert.ok(!/\n{3,}/.test(stripped));
});
