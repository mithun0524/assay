'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { GenerationPhase } from '@/lib/store';

/**
 * What a person watches while the agents work.
 *
 * First this was a five-stage stepper, which mostly lied — the phase sits on
 * 'writing' for minutes, so four of five dots stayed grey while a great deal
 * was happening. Then it was a headline and a running feed above the preview
 * frame, which was honest but said the same thing the chat status line and the
 * header pill were already saying, three times on one screen, above a large
 * empty box.
 *
 * So the box is the illustration now. The mark draws the metaphor it was built
 * around: heat travels up the A, and the bead settles under it — what an assay
 * leaves once the fire has taken everything that was not real. The status sits
 * beneath it, in the one place the eye is already pointed while waiting.
 */

type Props = {
  phase: GenerationPhase;
  hasError: boolean;
  previewUrl: string | null;
  activelyWritingFile: string | null;
  fileCount: number;
};

const PHASE_LABEL: Partial<Record<GenerationPhase, string>> = {
  installing: 'Installing dependencies',
  starting: 'Starting the dev server',
  verifying: 'Testing the app',
  searching: 'Searching the web',
  done: 'Ready',
};

/** The mark, animated. Static and complete when motion is reduced. */
function BuildMark({ tone }: { tone: 'working' | 'error' | 'idle' }) {
  return (
    <div className="relative grid place-items-center w-28 h-28">
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 rounded-full blur-2xl',
          tone === 'error' ? 'bg-rose-500/20' : 'bg-white/[0.07]',
          tone === 'working' && 'assay-glow'
        )}
      />
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className={cn(
          'relative w-16 h-16',
          tone === 'error' ? 'text-rose-400' : 'text-zinc-100'
        )}
        role="img"
        aria-label="Assay"
      >
        {/* The whole letter, always present — the tracer only lights part of it. */}
        <path
          d="M7 25 16 7l9 18"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={tone === 'working' ? 'opacity-25' : 'opacity-90'}
        />
        {tone === 'working' && (
          <path
            d="M7 25 16 7l9 18"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="assay-trace"
          />
        )}
        {tone === 'working' && (
          <circle cx="16" cy="20.5" r="2.6" fill="currentColor" className="assay-halo" />
        )}
        <circle
          cx="16"
          cy="20.5"
          r="2.6"
          fill="currentColor"
          className={tone === 'working' ? 'assay-bead' : 'opacity-90'}
        />
      </svg>
    </div>
  );
}

export const BuildSurface = memo(function BuildSurface({
  phase,
  hasError,
  previewUrl,
  activelyWritingFile,
  fileCount,
}: Props) {
  const working = phase !== 'idle' && phase !== 'done';
  const tone = hasError ? 'error' : working ? 'working' : 'idle';

  const headline = hasError
    ? 'The build stopped'
    : activelyWritingFile
      ? `Writing ${activelyWritingFile.split('/').pop()}`
      : (PHASE_LABEL[phase] ??
        (fileCount > 0 ? 'Writing files' : working ? 'Working out the files' : 'Your app appears here'));

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex-1 min-h-0 rounded-xl border border-white/[0.06] bg-[var(--bg-raised)] overflow-hidden flex flex-col">
        <div className="h-7 shrink-0 flex items-center px-2.5 border-b border-white/[0.06]">
          <span className="font-mono text-[10px] text-zinc-500 truncate">
            {previewUrl ?? 'no server running yet'}
          </span>
        </div>

        {previewUrl ? (
          <iframe
            src={previewUrl}
            title="App preview"
            className="flex-1 w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div className="flex-1 grid place-items-center p-6">
            <div className="flex flex-col items-center text-center">
              <BuildMark tone={tone} />

              <p
                className={cn(
                  'mt-3 text-[15px] font-medium tracking-[-0.01em]',
                  hasError ? 'text-rose-300' : working ? 'shimmer-text' : 'text-zinc-400'
                )}
                aria-live="polite"
              >
                {headline}
              </p>

              {/* The full path, under the short name in the headline — enough to
                  tell two index.ts apart without widening the line. */}
              {activelyWritingFile && !hasError && (
                <p className="mt-1.5 font-mono text-[11px] text-zinc-600 max-w-[280px] truncate">
                  {activelyWritingFile}
                </p>
              )}

              {fileCount > 0 && (
                <p className="mt-2 font-mono text-[11px] text-zinc-500 tabular-nums">
                  {fileCount} {fileCount === 1 ? 'file' : 'files'} written
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
