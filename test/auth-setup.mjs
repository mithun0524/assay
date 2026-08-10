/**
 * One-time sign-in for the browser suites.
 *
 *   npm run dev
 *   node test/auth-setup.mjs
 *
 * Opens a real browser window, waits for you to sign in however you like
 * (GitHub, Google or email), then saves the session to .auth/state.json.
 * feature-sweep and ui-smoke pick that file up automatically, so they test the
 * authenticated app instead of bouncing off the auth gate.
 *
 * No credentials are ever typed by, or visible to, the agent — you sign in
 * yourself in the window. .auth/ is gitignored.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const TIMEOUT_MS = 8 * 60 * 1000;

// Fail fast rather than opening a window against a dead server.
try {
  const res = await fetch(`${BASE}/login`, { redirect: 'manual' });
  if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
} catch (err) {
  console.error(`\n  Cannot reach ${BASE} — start the dev server first:\n    npm run dev\n`);
  console.error(`  (${err instanceof Error ? err.message : err})`);
  process.exit(1);
}

mkdirSync('.auth', { recursive: true });

const browser = await chromium.launch({
  headless: false,
  args: ['--window-size=1280,900', '--window-position=80,60'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });

console.log('\n  ┌────────────────────────────────────────────────┐');
console.log('  │  A browser window just opened.                 │');
console.log('  │  Sign in there — GitHub, Google or email.       │');
console.log('  │  This terminal will say when it has the session.│');
console.log('  └────────────────────────────────────────────────┘');
console.log('  Waiting up to 8 minutes. Progress prints below.\n');

// Closing the window is a normal way to abandon this — treat it as a cancel,
// not a crash.
let closed = false;
context.on('close', () => { closed = true; });
page.on('close', () => { closed = true; });

const started = Date.now();
let signedIn = false;
let lastReport = '';

while (!closed && Date.now() - started < TIMEOUT_MS) {
  // Both signals, not either. A 200 alone was enough to fool this once: the
  // dev server had been built with an auth bypass in the tree, so every
  // endpoint answered 200 and we saved a session containing no cookies at all.
  // A real Supabase cookie cannot be faked by a misbuilt server.
  let status = 0;
  try {
    status = (await page.request.get(`${BASE}/api/user/secrets`)).status();
  } catch { /* page navigating mid-OAuth */ }

  const cookies = await context.cookies();
  const sb = cookies.filter((c) => c.name.startsWith('sb-')).map((c) => c.name);

  if (status === 200 && sb.length > 0) {
    signedIn = true;
    break;
  }
  const report = `url=${page.url().slice(0, 60)} api=${status} sb-cookies=[${sb.join(', ') || 'none'}]`;
  if (report !== lastReport) {
    lastReport = report;
    console.log(`  ${Math.round((Date.now() - started) / 1000)}s  ${report}`);
  }
  try {
    await page.waitForTimeout(2000);
  } catch {
    closed = true; // window went away mid-wait
  }
}

if (closed && !signedIn) {
  console.error('\n  Window closed before sign-in completed. Nothing saved.');
  console.error('  Re-run `npm run test:auth` when you are ready.');
  await browser.close().catch(() => {});
  process.exit(1);
}

if (!signedIn) {
  console.error('\n  No session detected before the timeout. Nothing saved.');
  console.error('  Last seen:', lastReport || '(never polled)');
  console.error('  If sb-cookies was never set, the sign-in did not complete.');
  console.error('  If cookies were set but api stayed 401, the callback did not');
  console.error('  exchange the code — check the Redirect URL allow-list.');
  await browser.close();
  process.exit(1);
}

const state = await context.storageState({ path: '.auth/state.json' });
if (!state.cookies.length) {
  console.error('  Captured state has no cookies — refusing to save a session');
  console.error('  that would silently fail. Is the dev server built with auth on?');
  await browser.close();
  process.exit(1);
}
const who = await page.request.get(`${BASE}/api/user/secrets`).then((r) => r.json());
console.log('  Session captured → .auth/state.json');
console.log('  Server sees:', JSON.stringify(who));
console.log('\n  You can close the window. Suites will reuse this session.\n');

await browser.close();
