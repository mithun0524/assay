/**
 * Renders the promo motion graphic to public/promo.mp4 (+ .webm).
 *
 *   npm run promo:render
 *
 * Edit remotion/Promo.tsx and re-run. `npm run promo:studio` opens the live
 * editor if you want to scrub while tweaking.
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const entry = path.resolve('remotion/index.ts');
console.log('bundling…');
const serveUrl = await bundle({ entryPoint: entry, onProgress: () => {} });

const composition = await selectComposition({ serveUrl, id: 'Promo' });
console.log(`rendering ${composition.durationInFrames} frames…`);

await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: 'public/promo.mp4',
  crf: 26,
  onProgress: ({ progress }) => {
    if (Math.round(progress * 100) % 20 === 0) process.stdout.write(`${Math.round(progress * 100)}% `);
  },
});

console.log('\ntranscoding webm…');
execFileSync(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-i', 'public/promo.mp4', '-c:v', 'libvpx-vp9',
   '-crf', '38', '-b:v', '0', '-row-mt', '1', '-an', 'public/promo.webm'],
  { stdio: 'inherit' }
);

console.log('wrote public/promo.mp4 and public/promo.webm');
