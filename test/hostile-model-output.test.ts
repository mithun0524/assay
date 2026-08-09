/**
 * Treats the model as hostile.
 *
 * Everything the agent emits — file paths, file bodies, shell commands — is
 * attacker-controllable in practice: a prompt-injected model, a poisoned
 * template, or a malicious instruction hidden in a file the agent was asked to
 * read will all come back through the same parser. These assert what the client
 * does with output it should not trust.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSandboxPath } from '../lib/sandboxUtils';
import { createStreamParser, stripActions } from '../lib/streamParser';

/* ───────────────────────── path containment ───────────────────────── */

test('no model-supplied path can escape the project root', () => {
  const escapes = [
    '../../etc/passwd',
    '../../../../../../etc/shadow',
    '/etc/passwd',
    '//etc/passwd',
    './../../root/.ssh/id_rsa',
    'src/../../../../home/user/.aws/credentials',
    'a/b/c/../../../../../../../../tmp/pwned',
    '....//....//etc/passwd',
    '..\\..\\Windows\\System32\\config\\SAM',
    'src\\..\\..\\..\\secret',
    '   ../../etc/passwd   ',
    '/../..//../etc/passwd',
  ];

  for (const raw of escapes) {
    const p = normalizeSandboxPath(raw);
    if (p === null) continue; // refused outright, also fine
    assert.ok(!p.startsWith('/'), `${raw} -> ${p} is absolute`);
    // `....` is a legal (if odd) directory name, so test segments rather than
    // prefixes — only a segment that is exactly ".." can walk upwards.
    assert.ok(!p.split('/').includes('..'), `${raw} -> ${p} still contains ..`);
    assert.ok(!/^[a-zA-Z]:/.test(p), `${raw} -> ${p} kept a drive letter`);
  }
});

test('paths that resolve to nothing are refused, not silently rooted', () => {
  for (const raw of ['..', '../..', '/', '///', './', '.', '   ', '']) {
    assert.equal(normalizeSandboxPath(raw), null, `expected refusal for ${JSON.stringify(raw)}`);
  }
});

test('non-strings cannot reach the filesystem', () => {
  for (const raw of [null, undefined, 42, {}, [], true]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.equal(normalizeSandboxPath(raw as any), null, `expected refusal for ${String(raw)}`);
  }
});

test('a path that is only traversal plus separators cannot become a real file', () => {
  // The dangerous shape is one that pops to empty and then re-enters, because a
  // naive guard that only checks the *input* for ".." would pass the result.
  const p = normalizeSandboxPath('src/../../../../.env');
  assert.equal(p, '.env');
  assert.ok(!p!.includes('..'));
});

/* ───────────────────────── parser robustness ───────────────────────── */

async function collect(chunks: string[]) {
  const actions: unknown[] = [];
  const parser = createStreamParser((a) => { actions.push(a); });
  for (const c of chunks) parser.feed(c);
  await parser.flush();
  return actions;
}

test('a malicious action cannot smuggle a path past the parser', async () => {
  const actions = await collect([
    `<boltAction type="file" filePath="../../../../etc/passwd">root::0:0</boltAction>`,
  ]) as Array<{ type: string; filePath?: string }>;

  const file = actions.find((a) => a.type === 'file');
  assert.ok(file, 'expected a file action');
  // The parser is allowed to hand the raw path through — containment is the
  // filesystem layer's job — but the composed result must still be contained.
  assert.ok(!normalizeSandboxPath(file!.filePath!)!.includes('..'));
});

test('unterminated and nested actions do not hang or throw', async () => {
  await assert.doesNotReject(() => collect([`<boltAction type="file" filePath="a.ts">unterminated`]));
  await assert.doesNotReject(() => collect([
    `<boltAction type="file" filePath="a.ts"><boltAction type="file" filePath="b.ts">x</boltAction>`,
  ]));
  await assert.doesNotReject(() => collect([`<boltAction`, ` type="file"`, ` filePath="a.ts">`, `x</bolt`, `Action>`]));
});

test('a payload split across chunks mid-attribute still resolves to one action', async () => {
  const actions = await collect([
    '<boltAction type="fi', 'le" filePath="src/A', 'pp.tsx">hello</boltAction>',
  ]) as Array<{ type: string; filePath?: string; content?: string }>;
  const file = actions.find((a) => a.type === 'file');
  assert.equal(file?.filePath, 'src/App.tsx');
});

test('action markup is stripped from what the user is shown', () => {
  // If this leaks, raw markup renders in the transcript — and anything the
  // model puts in an attribute is displayed verbatim.
  const raw = `Sure!<boltAction type="file" filePath="x.ts">const secret = 1</boltAction>Done.`;
  const shown = stripActions(raw);
  assert.ok(!shown.includes('boltAction'), 'markup leaked into display text');
  assert.ok(!shown.includes('const secret'), 'file body leaked into display text');
});

test('an enormous file body does not blow up the parser', async () => {
  const huge = 'x'.repeat(2_000_000);
  await assert.doesNotReject(() => collect([`<boltAction type="file" filePath="big.txt">${huge}</boltAction>`]));
});

test('attribute injection cannot forge a second action', async () => {
  // A model that emits a quote inside filePath must not be able to close the
  // attribute early and start a new action with different intent.
  const actions = await collect([
    `<boltAction type="file" filePath="a.ts" onerror="alert(1)"><script>alert(1)</script></boltAction>`,
  ]) as Array<{ type: string; filePath?: string; content?: string }>;
  const files = actions.filter((a) => a.type === 'file');
  assert.equal(files.length, 1, 'attribute injection produced extra actions');
  // The body is written to a file, never executed by us — but it must not be
  // silently reinterpreted as markup either.
  assert.ok(files[0].content?.includes('<script>'), 'body was mangled');
});
