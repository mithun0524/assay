/**
 * The failure mode this covers is the worst kind: nothing throws.
 *
 * Some models answer with tool-call markup instead of the boltAction markup
 * this app parses. When that happens the parser yields zero actions, no files
 * are written, and the turn ends looking exactly like a success — the agent
 * says "I'll build a complete application", the preview stays blank, and
 * nothing anywhere says the build produced nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStreamParser, stripActions, claimsToBuild, type BoltAction } from '../lib/streamParser';

async function parse(text: string): Promise<BoltAction[]> {
  const actions: BoltAction[] = [];
  const p = createStreamParser((a) => { actions.push(a); });
  p.feed(text);
  await p.flush();
  return actions;
}

test('a boltAction wrapped in tool-call markup still parses', async () => {
  // The wrapper is noise around the payload — it must not cost us the file.
  const actions = await parse(
    `<tool_call>\n<boltAction type="file" filePath="src/App.tsx">export default () => null;</boltAction>\n</tool_call>`
  );
  assert.equal(actions.length, 1);
  assert.equal((actions[0] as { filePath: string }).filePath, 'src/App.tsx');
});

test('a turn that emits tool-call markup INSTEAD of actions produces nothing', async () => {
  // This is the blank-screen case, pinned so it stays visible.
  const actions = await parse(
    `<tool_call>{"name":"create_file","arguments":{"path":"src/App.tsx","content":"x"}}</tool_call>`
  );
  assert.equal(actions.length, 0, 'expected the parser to yield nothing here');
});

test('an intent to build with no actions is detectable', async () => {
  const said = "I'll build a complete personal finance tracker with React and localStorage.";
  const actions = await parse(said);
  assert.equal(actions.length, 0);
  assert.ok(claimsToBuild(said), 'this is the sentence that should raise a flag');
});

test('talking without building is not flagged', () => {
  assert.equal(claimsToBuild('That error comes from a missing dependency in package.json.'), false);
  assert.equal(claimsToBuild('The board crashes because the column resolves late.'), false);
});

test('tool-call markup never reaches the transcript', () => {
  assert.equal(
    stripActions('Let me check the current state of the files.\n\n</tool_call>'),
    'Let me check the current state of the files.'
  );
  assert.equal(
    stripActions('Working.\n<tool_call>\n<boltAction type="file" filePath="a.ts">x</boltAction>\n</tool_call>'),
    'Working.'
  );
});

test('an unterminated action does not dump a file body into the transcript', () => {
  // The stream cut off mid-action, or the model never closed the tag.
  const shown = stripActions(
    'Creating the board.\n<boltAction type="file" filePath="src/Board.tsx">const secret = 1;\nexport default Board;'
  );
  assert.equal(shown, 'Creating the board.');
  assert.ok(!shown.includes('boltAction'));
  assert.ok(!shown.includes('const secret'));
});

/* ── display: the same markup must not reach the transcript either ── */

test('a tool-call payload is dropped, but one wrapping real actions is not', async () => {
  const { formatForDisplay } = await import('../lib/displayFormatter');

  // payload only — nothing here was ever consumed, so none of it should show
  const dropped = formatForDisplay(
    `I'll build it.\n\n<tool_call>{"name":"create_file","arguments":{"path":"src/App.tsx"}}</tool_call>`
  );
  assert.ok(!dropped.includes('tool_call'), 'markup leaked');
  assert.ok(!dropped.includes('create_file'), 'raw tool payload leaked into the transcript');
  assert.ok(dropped.includes("I'll build it."), 'the actual prose was lost');

  // wrapping real actions — the actions still have to be found
  const kept = formatForDisplay(
    `Working.\n<tool_call>\n<boltAction type="file" filePath="src/App.tsx">x</boltAction>\n</tool_call>`
  );
  assert.ok(!kept.includes('tool_call'), 'markup leaked');
  assert.ok(kept.includes('src/App.tsx'), 'the wrapped action was thrown away with its wrapper');
});
