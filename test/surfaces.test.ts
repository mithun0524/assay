import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  visibleSurfaces,
  surfaceToFocus,
  firstAvailable,
  type SurfaceState,
} from '../lib/surfaces';

const base: SurfaceState = {
  fileCount: 0,
  hasPreview: false,
  hasOutput: false,
  isStreaming: false,
  phase: 'idle',
  hasError: false,
};
const s = (over: Partial<SurfaceState> = {}): SurfaceState => ({ ...base, ...over });
const ids = (tier: 'simple' | 'developer', st: SurfaceState) =>
  visibleSurfaces(tier, st).map((x) => x.id);

test('a simple user is never offered code or logs', () => {
  const busy = s({ fileCount: 12, hasPreview: true, hasOutput: true, phase: 'done' });
  assert.deepEqual(ids('simple', busy), ['build', 'app']);
  assert.deepEqual(ids('developer', busy), ['build', 'app', 'code', 'logs']);
});

test('surfaces stay hidden until they mean something', () => {
  // nothing has happened yet
  assert.deepEqual(ids('developer', s()), []);
  // code needs files, logs needs output, app needs a preview url
  assert.deepEqual(ids('developer', s({ fileCount: 1 })), ['build', 'code']);
  assert.deepEqual(ids('developer', s({ hasOutput: true, fileCount: 1 })), ['build', 'code', 'logs']);
});

test('build takes focus while the agent works, app takes it when the app runs', () => {
  const writing = s({ isStreaming: true, phase: 'writing', fileCount: 3 });
  assert.equal(surfaceToFocus('simple', writing, null), 'build');

  const ready = s({ hasPreview: true, phase: 'done', fileCount: 8 });
  assert.equal(surfaceToFocus('simple', ready, 'build'), 'app');
});

test('focus does not fight the user once they are already there', () => {
  const writing = s({ isStreaming: true, phase: 'writing', fileCount: 3 });
  // already on build and build is what wants focus → do not re-set it
  assert.equal(surfaceToFocus('simple', writing, 'build'), null);
});

test('a failure pulls a developer to logs but never a simple user', () => {
  const broke = s({ hasError: true, hasOutput: true, hasPreview: true, fileCount: 5, phase: 'done' });
  assert.equal(surfaceToFocus('developer', broke, 'app'), 'logs');
  // logs is not in the simple tier, so it can never be focused for them
  assert.notEqual(surfaceToFocus('simple', broke, 'app'), 'logs');
});

test('app does not steal focus while the build is broken', () => {
  const broke = s({ hasError: true, hasPreview: true, fileCount: 5, phase: 'done' });
  assert.notEqual(surfaceToFocus('simple', broke, 'build'), 'app');
});

test('a user stranded on a vanished surface is moved somewhere real', () => {
  // was on code, then switched down to the simple tier
  const st = s({ fileCount: 5, hasPreview: true, phase: 'done' });
  assert.equal(surfaceToFocus('simple', st, 'code'), 'app');
  // and with nothing available at all, nothing is forced
  assert.equal(surfaceToFocus('simple', s(), null), null);
  assert.equal(firstAvailable('simple', s()), null);
});

test('nothing is focused when no surface asks and the current one is fine', () => {
  const idleWithFiles = s({ fileCount: 4, hasOutput: true });
  assert.equal(surfaceToFocus('developer', idleWithFiles, 'code'), null);
});
