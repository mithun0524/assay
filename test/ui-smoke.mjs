/**
 * UI smoke test — drives a whole build turn against a scripted model.
 *
 *   npm run dev            # in another terminal
 *   npm run ui:smoke       # writes screenshots to ./screenshots
 *
 * The model API is intercepted, so this needs no OpenRouter key: it exercises
 * the real parser, sandbox, QA gate and chat surface end to end.
 */

import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

// Reuse the session captured by `node test/auth-setup.mjs`. Without it the
// suite bounces off the auth gate and tests nothing.
const STORAGE = existsSync('.auth/state.json') ? { storageState: '.auth/state.json' } : {};
if (!existsSync('.auth/state.json')) {
  console.log('NOTE: no .auth/state.json — run `node test/auth-setup.mjs` first.\n');
}


const OUT = process.env.OUT || 'screenshots';
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const AGENT_REPLY = `I'll scaffold a Kanban board with drag and drop and localStorage persistence.

<boltAction type="list">src/**/*.tsx</boltAction>`;

const CODER_REPLY = `Creating the board, the column component and the persistence hook.

<boltAction type="file" filePath="package.json">{
  "name": "kanban",
  "scripts": { "dev": "vite --host" },
  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" }
}
</boltAction><boltAction type="file" filePath="src/App.tsx">import { Board } from './components/Board';

export default function App() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <Board />
    </main>
  );
}
</boltAction><boltAction type="file" filePath="src/hooks/useBoard.ts">import { useEffect, useState } from 'react';

export function useBoard() {
  const [columns, setColumns] = useState(() => load());
  useEffect(() => save(columns), [columns]);
  return { columns, setColumns };
}
</boltAction><boltAction type="delete" filePath="src/Placeholder.tsx"></boltAction><boltAction type="shell">npm install</boltAction><boltAction type="start">npm run dev</boltAction>

The board persists to localStorage on every change.`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1512, height: 900 }, ...STORAGE });
const page = await context.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 160)));

let turn = 0;
await page.route('**/api/classify', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      role: turn === 0 ? 'architect' : 'coder',
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      reasoning: turn === 0 ? 'No project yet — planning the initial structure' : 'Implementing features and writing code',
    }),
  })
);

await page.route('**/api/chat', async (route) => {
  const body = turn === 0 ? AGENT_REPLY : CODER_REPLY;
  turn++;
  await route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body });
});

await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const box = page.locator('textarea').first();
await box.click();
await box.fill('Build a kanban board with drag and drop and localStorage persistence');
await box.press('Enter');
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/ui-turn1.png` });

const box2 = page.locator('textarea').first();
await box2.click();
await box2.fill('Now add a dark theme toggle in the header');
await box2.press('Enter');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/ui-turn2.png` });

// Chat panel on its own, at a realistic reading width
const panel = page.locator('textarea').first().locator('xpath=ancestor::div[contains(@class,"flex-col")][1]');
await panel.screenshot({ path: `${OUT}/ui-panel.png` }).catch(() => {});

await page.setViewportSize({ width: 430, height: 900 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/ui-mobile.png` });

console.log('console errors:', errors.length ? errors.slice(0, 6) : 'none');
if (errors.some((e) => e.startsWith('PAGEERROR'))) process.exitCode = 1;
await browser.close();
