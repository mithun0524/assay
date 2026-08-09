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
  // build is always there; the rest have to earn their place
  assert.deepEqual(ids('developer', s()), ['build']);
  // code needs files, logs needs output, app needs a preview url
  assert.deepEqual(ids('developer', s({ fileCount: 1 })), ['build', 'code']);
  assert.deepEqual(ids('developer', s({ hasOutput: true, fileCount: 1 })), ['build', 'code', 'logs']);
});

test('the panel is never left with nothing to render', () => {
  // Regression: a project whose first turn failed before writing anything has
  // messages but no files, no preview and an idle phase. Every surface was
  // unavailable, so the tab bar was empty and the right-hand panel rendered
  // nothing at all — worse than the layout it replaced.
  const firstTurnFailed = s({ fileCount: 0, hasPreview: false, hasOutput: false, phase: 'idle', hasError: true });
  for (const tier of ['simple', 'developer'] as const) {
    assert.ok(visibleSurfaces(tier, firstTurnFailed).length > 0,
      `${tier} tier had no surface to show`);
    assert.ok(surfaceToFocus(tier, firstTurnFailed, null),
      `${tier} tier resolved to no surface`);
  }

  // and the same holds for every combination of the flags, at both tiers
  for (const fileCount of [0, 3]) {
    for (const hasPreview of [false, true]) {
      for (const hasOutput of [false, true]) {
        for (const isStreaming of [false, true]) {
          for (const hasError of [false, true]) {
            const st = s({ fileCount, hasPreview, hasOutput, isStreaming, hasError });
            for (const tier of ['simple', 'developer'] as const) {
              assert.ok(visibleSurfaces(tier, st).length > 0,
                `empty for ${tier} ${JSON.stringify(st)}`);
            }
          }
        }
      }
    }
  }
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
  // and from a standing start there is always somewhere to land
  assert.equal(surfaceToFocus('simple', s(), null), 'build');
  assert.equal(firstAvailable('simple', s()), 'build');
});

test('nothing is focused when no surface asks and the current one is fine', () => {
  const idleWithFiles = s({ fileCount: 4, hasOutput: true });
  assert.equal(surfaceToFocus('developer', idleWithFiles, 'code'), null);
});
