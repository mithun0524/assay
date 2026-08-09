/**
 * Accessibility audit. Needs the dev server running.
 *   BASE_URL=http://localhost:3001 node test/a11y-audit.mjs
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PAGES = ['/landing', '/login', '/app'];

const browser = await chromium.launch();
let total = 0;

for (const path of PAGES) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(path === '/landing' ? 9000 : 3000);

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  console.log(`\n${path} — ${violations.length} violation type(s)`);
  for (const v of violations) {
    total += v.nodes.length;
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`);
    for (const n of v.nodes.slice(0, 3)) {
      console.log(`      ${n.target.join(' ')}`);
      const summary = (n.failureSummary || '').split('\n').filter(Boolean).slice(1, 3).join(' | ');
      if (summary) console.log(`      → ${summary}`);
    }
  }

  // Keyboard reachability of the primary action
  const focusables = await page.evaluate(() =>
    document.querySelectorAll('a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])').length
  );
  console.log(`  focusable elements: ${focusables}`);
  await context.close();
}

console.log(`\nTOTAL failing nodes: ${total}`);
await browser.close();
