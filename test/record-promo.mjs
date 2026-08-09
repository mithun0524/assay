/**
 * Records real product footage for the landing page.
 *
 *   npm run dev
 *   node test/record-promo.mjs        # writes public/promo.mp4 + public/promo.webm
 *
 * The model API is intercepted with a scripted build, so this needs no API key
 * and always produces the same take: prompt → agents stream files in → install →
 * dev server → preview. Everything on screen is the real app.
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const dir = mkdtempSync(join(tmpdir(), 'devforge-promo-'));

const PLAN = `Three columns, drag between them, and the board state in localStorage.

<boltAction type="list">src/**</boltAction>`;

const BUILD = `Writing the board, the column and the persistence hook.

<boltAction type="file" filePath="package.json">{
  "name": "kanban",
  "private": true,
  "scripts": { "dev": "vite --host" },
  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": { "vite": "^7.0.0", "@vitejs/plugin-react": "^5.0.0" }
}
</boltAction><boltAction type="file" filePath="vite.config.js">import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [react()], server: { host: true } });
</boltAction><boltAction type="file" filePath="index.html"><!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Board</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
</boltAction><boltAction type="file" filePath="src/main.jsx">import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(<App />);
</boltAction><boltAction type="file" filePath="src/index.css">* { box-sizing: border-box; }
body { margin: 0; background: #0b0b0f; color: #e8e8ec;
  font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
</boltAction><boltAction type="file" filePath="src/App.jsx">import { useEffect, useState } from 'react';

const SEED = {
  todo: ['Design the board', 'Pick a drag library', 'Write the persistence hook'],
  doing: ['Column component'],
  done: ['Project scaffold'],
};

export default function App() {
  const [cols, setCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('board')) ?? SEED; }
    catch { return SEED; }
  });

  useEffect(() => { localStorage.setItem('board', JSON.stringify(cols)); }, [cols]);

  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ margin: '0 0 28px', fontSize: 26, letterSpacing: '-0.02em' }}>Board</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {Object.entries(cols).map(([name, cards]) => (
          <section key={name} style={{ background: '#131318', borderRadius: 14, padding: 16 }}>
            <h2 style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase',
                         color: '#8b8b96', margin: '0 0 14px' }}>{name}</h2>
            {cards.map((c) => (
              <article key={c} draggable style={{ background: '#1c1c23', borderRadius: 10,
                        padding: '12px 14px', marginBottom: 10, cursor: 'grab' }}>{c}</article>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
</boltAction><boltAction type="shell">npm install</boltAction><boltAction type="start">npm run dev</boltAction>

The board persists to localStorage on every change.`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

let turn = 0;
await page.route('**/api/classify', (r) =>
  r.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ role: turn === 0 ? 'architect' : 'coder', model: 'x', reasoning: 'demo' }),
  })
);
await page.route('**/api/chat', async (r) => {
  const body = turn === 0 ? PLAN : BUILD;
  turn++;
  await r.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', body });
});

await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const box = page.locator('textarea').first();
await box.click();
// type it out so the take shows a real prompt being written
await box.type('Build a kanban board that survives a refresh', { delay: 45 });
await page.waitForTimeout(700);
await box.press('Enter');

// the agents work: transcript streams, files land, install runs, server boots
await page.waitForTimeout(26000);

// show the code that was written
await page.locator('button').filter({ hasText: /^Code$/i }).first().click().catch(() => {});
await page.waitForTimeout(1800);
const file = page.locator('span.truncate:visible').filter({ hasText: /App\.jsx/ }).first();
if (await file.count()) {
  await file.click();
  await page.waitForTimeout(3500);
}

// and the app it produced
await page.locator('button').filter({ hasText: /^Preview$/i }).first().click().catch(() => {});
await page.waitForTimeout(5000);

await context.close();
await browser.close();

const raw = join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')));

// Trim the dead air at the start, speed it up slightly, and cap the size.
const common = ['-i', raw, '-an', '-ss', '1.2', '-t', '38',
  '-vf', 'setpts=0.62*PTS,scale=1280:-2:flags=lanczos'];

execFileSync('ffmpeg', ['-y', ...common, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'public/promo.mp4'], { stdio: 'inherit' });

execFileSync('ffmpeg', ['-y', ...common, '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0',
  '-row-mt', '1', 'public/promo.webm'], { stdio: 'inherit' });

rmSync(dir, { recursive: true, force: true });
console.log('wrote public/promo.mp4 and public/promo.webm');
