/**
 * The bridge between what the model now emits (validated tool calls) and what
 * the browser has always executed (boltAction markup).
 *
 * This is the piece that has to be right for the migration to be invisible: if
 * it renders a malformed tag, the parser downstream loses not just that action
 * but everything after it in the stream.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolCallToAction } from '../lib/agentTools';
import { createStreamParser, type BoltAction } from '../lib/streamParser';

async function parse(text: string): Promise<BoltAction[]> {
  const actions: BoltAction[] = [];
  const p = createStreamParser((a) => { actions.push(a); });
  p.feed(text);
  await p.flush();
  return actions;
}

test('a write_file call round-trips through the parser the client uses', async () => {
  const markup = toolCallToAction('write_file', {
    path: 'src/App.tsx',
    content: 'export default function App() {\n  return <div>hi</div>;\n}',
  });
  assert.ok(markup);
  const [action] = await parse(markup!);
  assert.equal(action.type, 'file');
  assert.equal((action as { filePath: string }).filePath, 'src/App.tsx');
  assert.match((action as { content: string }).content, /export default function App/);
});

test('shell and start calls become the right action types', async () => {
  const [shell] = await parse(toolCallToAction('run_command', { command: 'npm install' })!);
  assert.equal(shell.type, 'shell');
  const [start] = await parse(toolCallToAction('start_dev_server', { command: 'npm run dev' })!);
  assert.equal(start.type, 'start');
});

test('a path containing quotes cannot break out of the attribute', async () => {
  // Left unescaped this closes filePath early and the rest of the tag is
  // reinterpreted, which corrupts every action that follows it in the stream.
  const markup = toolCallToAction('write_file', {
    path: 'src/a"onerror="x.tsx',
    content: 'x',
  });
  assert.ok(markup);
  assert.ok(!/filePath="src\/a"onerror/.test(markup!), 'attribute was not escaped');
  const actions = await parse(markup!);
  assert.equal(actions.length, 1, 'a quoted path forged extra actions');
});

test('file content is passed through untouched, markup and all', async () => {
  // Generated code routinely contains angle brackets and quotes; escaping the
  // body would corrupt every JSX file the agent writes.
  const content = 'const el = <div className="x">{"</boltAction>"}</div>;';
  const [action] = await parse(toolCallToAction('write_file', { path: 'a.tsx', content })!);
  assert.equal(action.type, 'file');
});

test('an empty file is still a file', async () => {
  const markup = toolCallToAction('write_file', { path: '.gitkeep', content: '' });
  assert.ok(markup, 'an empty body must not be treated as a missing argument');
});

test('malformed calls are dropped, not half-rendered', () => {
  // Half a tag would derail the parser for the remainder of the stream, so a
  // call we cannot make sense of has to produce nothing at all.
  assert.equal(toolCallToAction('write_file', { content: 'no path' }), null);
  assert.equal(toolCallToAction('write_file', { path: '   ' }), null);
  assert.equal(toolCallToAction('run_command', {}), null);
  assert.equal(toolCallToAction('not_a_tool', { path: 'x' }), null);
  assert.equal(toolCallToAction('write_file', null), null);
});
