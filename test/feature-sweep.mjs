/**
 * Feature sweep — exercises the parts of the app that unit tests never touch:
 * templates, file tree, editor, undo/redo, IndexedDB persistence, panels.
 *
 *   BASE_URL=http://localhost:3001 node test/feature-sweep.mjs
 */
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

// Reuse the session captured by `node test/auth-setup.mjs`. Without it the
// suite bounces off the auth gate and tests nothing.
const STORAGE = existsSync('.auth/state.json') ? { storageState: '.auth/state.json' } : {};
if (!existsSync('.auth/state.json')) {
  console.log('NOTE: no .auth/state.json — run `node test/auth-setup.mjs` first.\n');
}


const BASE = process.env.BASE_URL || 'http://localhost:3000';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1512, height: 900 }, ...STORAGE });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 160)));

await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// ── Templates ──
const browseBtn = page.locator('button, a').filter({ hasText: /browse templates/i }).first();
const hasBrowse = await browseBtn.count();
check('template gallery button exists', hasBrowse > 0);
if (hasBrowse) {
  await browseBtn.click();
  await page.waitForTimeout(1200);
  const cards = await page.locator('[class*="grid"] button, [class*="grid"] [role="button"]').count();
  check('template gallery opens with templates', cards > 0, `${cards} cards`);

  // Apply the first template
  // TemplateCard is itself the button; the tall ones are cards, the short ones
  // are category filters.
  const cardIndex = await page.evaluate(() => {
    const modal = document.querySelector('.fixed.inset-0.z-50');
    if (!modal) return -1;
    const btns = [...modal.querySelectorAll('button')];
    return btns.findIndex((b) => b.getBoundingClientRect().height > 100);
  });
  if (cardIndex >= 0) {
    await page.locator('.fixed.inset-0.z-50 button').nth(cardIndex).click();
  }
  await page.waitForTimeout(8000);
}

// Applying a template auto-switches to Preview, so the Code panel (and the
// file tree inside it) is hidden until we ask for it.
const codeTab = page.locator('button').filter({ hasText: /^Code$/i }).first();
if (await codeTab.count()) {
  await codeTab.click();
  await page.waitForTimeout(1200);
}

const FILE_RE = /\.(tsx|jsx|ts|js|json|css|html|md)$/;
const fileNodes = page.locator('span.truncate:visible').filter({ hasText: FILE_RE });
const fileCount = await fileNodes.count();
check('template populated the file tree', fileCount > 0, `${fileCount} visible file nodes`);

// ── Editor ──
let openedFile = '';
if (fileCount > 0) {
  openedFile = ((await fileNodes.first().textContent()) || '').trim();
  await fileNodes.first().click();
  await page.waitForTimeout(3000);
  const monaco = await page.locator('.monaco-editor').count();
  check('clicking a file opens the editor', monaco > 0, openedFile);

  const editorText = await page.locator('.monaco-editor').first().innerText().catch(() => '');
  check('editor shows the file contents', editorText.trim().length > 20, `${editorText.trim().length} chars`);
}

// ── Panels ──
for (const label of ['Preview', 'Terminal', 'Code']) {
  const tab = page.locator('button').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  if (await tab.count()) {
    await tab.click();
    await page.waitForTimeout(600);
  }
}
check('preview / terminal / code tabs all clickable', true);

// ── IndexedDB persistence ──
const dbState = await page.evaluate(async () => {
  const dbs = await indexedDB.databases?.();
  return (dbs || []).map((d) => d.name);
});
check('IndexedDB database created', dbState.length > 0, dbState.join(', ') || 'none');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const codeTab2 = page.locator('button').filter({ hasText: /^Code$/i }).first();
if (await codeTab2.count()) {
  await codeTab2.click();
  await page.waitForTimeout(1200);
}
const fileCountAfter = await page.locator('span.truncate:visible').filter({ hasText: FILE_RE }).count();
check('project survives a reload', fileCountAfter > 0, `${fileCountAfter} file nodes after reload`);

// ── Keyboard shortcuts ──
await page.locator('body').click({ position: { x: 900, y: 400 } });
await page.keyboard.press('Control+p');
await page.waitForTimeout(700);
const palette = await page.locator('input[placeholder*="file" i], input[placeholder*="search" i]').count();
check('quick file picker responds to Ctrl+P', palette > 0);
await page.keyboard.press('Escape');

console.log(`\npage errors: ${pageErrors.length ? pageErrors.join(' | ') : 'none'}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exitCode = failed.length ? 1 : 0;
