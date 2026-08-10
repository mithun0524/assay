'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { GenerationPhase } from '@/lib/store';

/**
 * What a person watches while the agents work.
 *
 * This used to be a five-stage stepper — PLAN / WRITE / INSTALL / TEST / RUN.
 * It was replaced because it mostly lied. The stages map to a generation phase
 * that sits on 'writing' for minutes at a time, so four of the five dots stayed
 * grey while a great deal was happening, and on a restored project every dot
 * was grey at once, which reads as a dead progress bar rather than a calm one.
 *
 * A running feed of what just happened is honest for the same cost: it moves
 * when the build moves, and when it stops moving you can see exactly where it
 * stopped.
 */

type Props = {
  phase: GenerationPhase;
  hasError: boolean;
  previewUrl: string | null;
  activelyWritingFile: string | null;
  fileCount: number;
};

type Entry = { id: number; text: string; kind: 'file' | 'phase' };

const PHASE_LABEL: Partial<Record<GenerationPhase, string>> = {
  installing: 'Installing dependencies',
  starting: 'Starting the dev server',
  verifying: 'Testing the app',
  searching: 'Searching the web',
  done: 'Ready',
};

export const BuildSurface = memo(function BuildSurface({
  phase,
  hasError,
  previewUrl,
  activelyWritingFile,
  fileCount,
}: Props) {
  const [log, setLog] = useState<Entry[]>([]);
  const seq = useRef(0);
  const lastFile = useRef<string | null>(null);
  const lastPhase = useRef<GenerationPhase | null>(null);

  // Append on change rather than on render, and cap the list — this runs for
  // the whole length of a build and a real one writes twenty-odd files.
  useEffect(() => {
    if (activelyWritingFile && activelyWritingFile !== lastFile.current) {
      lastFile.current = activelyWritingFile;
      setLog((l) => [...l, { id: seq.current++, text: activelyWritingFile, kind: 'file' as const }].slice(-40));
    }
  }, [activelyWritingFile]);

  useEffect(() => {
    const label = PHASE_LABEL[phase];
    if (label && phase !== lastPhase.current) {
      lastPhase.current = phase;
      setLog((l) => [...l, { id: seq.current++, text: label, kind: 'phase' as const }].slice(-40));
    }
  }, [phase]);

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const working = phase !== 'idle' && phase !== 'done';
  const headline = hasError
    ? 'The build stopped'
    : activelyWritingFile
      ? `Writing ${activelyWritingFile.split('/').pop()}`
      : PHASE_LABEL[phase] ?? (fileCount > 0 ? 'Writing files' : 'Working out the files');

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* ─── Live activity ─── */}
      <div className="shrink-0">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              'text-[15px] font-medium tracking-[-0.01em]',
              hasError ? 'text-rose-300' : working ? 'shimmer-text' : 'text-zinc-300'
            )}
          >
            {headline}
          </span>
          {fileCount > 0 && (
            <span className="ml-auto font-mono text-[11px] text-zinc-500 tabular-nums">
              {fileCount} {fileCount === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>

        {log.length > 0 && (
          <div
            ref={scroller}
            className="mt-2 max-h-[104px] overflow-y-auto pr-1 flex flex-col gap-[3px]"
            aria-live="polite"
          >
            {log.map((e) => (
              <div
                key={e.id}
                className={cn(
                  'font-mono text-[11px] leading-[1.5] animate-fade-up',
                  e.kind === 'phase' ? 'text-zinc-300' : 'text-zinc-500'
                )}
                style={{ animationDuration: '0.25s' }}
              >
                {e.kind === 'file' ? e.text : `— ${e.text}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── The frame the app appears in ─── */}
      <div className="flex-1 min-h-[180px] rounded-xl border border-white/[0.06] bg-[var(--bg-raised)] overflow-hidden flex flex-col">
        <div className="h-7 shrink-0 flex items-center px-2.5 border-b border-white/[0.06]">
          <span className="font-mono text-[10px] text-zinc-500 truncate">
            {previewUrl ?? 'no server running yet'}
          </span>
        </div>
        <div className="flex-1 grid place-items-center p-6">
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title="App preview"
              className="w-full h-full rounded-lg border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div className="w-full max-w-sm">
              <div className="flex flex-col gap-3" aria-hidden>
                <div className="skeleton h-2.5 w-2/5" />
                <div className="flex gap-3">
                  <div className="skeleton h-2.5 flex-1" />
                  <div className="skeleton h-2.5 flex-1" />
                  <div className="skeleton h-2.5 flex-1" />
                </div>
                <div className="flex gap-3">
                  <div className="skeleton h-14 flex-1" />
                  <div className="skeleton h-14 flex-1" />
                  <div className="skeleton h-14 flex-1" />
                </div>
                <div className="skeleton h-2.5 w-1/4" />
              </div>
              <p className="mt-4 text-center text-[11.5px] text-zinc-500">
                Your app appears here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
