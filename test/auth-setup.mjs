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

mkdirSync('.auth', { recursive: true });

const browser = await chromium.launch({
  headless: false,
  args: ['--window-size=1280,900', '--window-position=80,60'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });

console.log('\n  A browser window is open. Sign in there — any provider.');
console.log('  Waiting up to 8 minutes. Progress prints below.\n');

const started = Date.now();
let signedIn = false;
let lastReport = '';

while (Date.now() - started < TIMEOUT_MS) {
  // The server is the authority — a cookie alone proves nothing.
  let status = 0;
  try {
    status = (await page.request.get(`${BASE}/api/user/secrets`)).status();
  } catch { /* page navigating mid-OAuth */ }

  if (status === 200) {
    signedIn = true;
    break;
  }

  const cookies = await context.cookies();
  const sb = cookies.filter((c) => c.name.startsWith('sb-')).map((c) => c.name);
  const report = `url=${page.url().slice(0, 60)} api=${status} sb-cookies=[${sb.join(', ') || 'none'}]`;
  if (report !== lastReport) {
    lastReport = report;
    console.log(`  ${Math.round((Date.now() - started) / 1000)}s  ${report}`);
  }
  await page.waitForTimeout(2000);
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

await context.storageState({ path: '.auth/state.json' });
const who = await page.request.get(`${BASE}/api/user/secrets`).then((r) => r.json());
console.log('  Session captured → .auth/state.json');
console.log('  Server sees:', JSON.stringify(who));
console.log('\n  You can close the window. Suites will reuse this session.\n');

await browser.close();
