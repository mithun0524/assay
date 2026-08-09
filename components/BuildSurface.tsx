'use client';

import { memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { GenerationPhase } from '@/lib/store';

/**
 * What a person watches while the agents work.
 *
 * The transcript beside this deliberately says very little — one sentence per
 * agent and a status line — so this surface carries the sense of progress. It
 * shows two things and nothing else: which stage of the build we are in, and a
 * frame where the app is going to appear.
 *
 * It carries no install progress bar and no package ticker. The rail already
 * says INSTALL is lit and the transcript is already shimmering; a third
 * indicator of the same fact is noise.
 *
 * The rail is the landing page's own pipeline language (components/landing/
 * PipelineRail), which is the first time the product tells the same story its
 * marketing does.
 */

type Stage = { id: string; label: string; phases: GenerationPhase[] };

/** Ordered, and each maps to the generation phases that mean "here". */
const STAGES: Stage[] = [
  { id: 'plan', label: 'Plan', phases: ['searching'] },
  { id: 'write', label: 'Write', phases: ['writing'] },
  { id: 'install', label: 'Install', phases: ['installing'] },
  { id: 'test', label: 'Test', phases: ['verifying'] },
  { id: 'run', label: 'Run', phases: ['starting', 'done'] },
];

type StageState = 'done' | 'now' | 'todo' | 'failed';

function stageStates(phase: GenerationPhase, hasError: boolean): StageState[] {
  // 'idle' before anything has happened leaves every stage untouched rather
  // than implying the first one is running.
  const active = STAGES.findIndex((s) => s.phases.includes(phase));

  return STAGES.map((_, i) => {
    if (active === -1) return phase === 'idle' ? 'todo' : 'done';
    if (i < active) return 'done';
    if (i > active) return 'todo';
    return hasError ? 'failed' : 'now';
  });
}

const DOT: Record<StageState, string> = {
  done: 'bg-emerald-400 border-emerald-400',
  now: 'bg-[var(--agent-architect)] border-[var(--agent-architect)] animate-pulse',
  failed: 'bg-rose-400 border-rose-400',
  todo: 'bg-[var(--bg-overlay)] border-white/[0.12]',
};

const LABEL: Record<StageState, string> = {
  done: 'text-zinc-400',
  now: 'text-zinc-100',
  failed: 'text-rose-400',
  todo: 'text-zinc-500',
};

const BAR: Record<StageState, string> = {
  done: 'bg-emerald-400',
  now: 'bg-gradient-to-r from-emerald-400 to-[var(--agent-architect)]',
  failed: 'bg-gradient-to-r from-emerald-400 to-rose-400',
  todo: 'bg-white/[0.12]',
};

export const BuildSurface = memo(function BuildSurface({
  phase,
  hasError,
  previewUrl,
}: {
  phase: GenerationPhase;
  hasError: boolean;
  previewUrl: string | null;
}) {
  const states = useMemo(() => stageStates(phase, hasError), [phase, hasError]);

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">
      {/* ─── Pipeline rail ─── */}
      <ol className="flex items-start px-1 pt-1" aria-label="Build progress">
        {STAGES.map((stage, i) => {
          const state = states[i];
          return (
            <li
              key={stage.id}
              className="flex-1 flex flex-col items-center gap-1.5 relative"
              aria-current={state === 'now' ? 'step' : undefined}
            >
              {/* connector to the previous node, drawn behind the dot */}
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn('absolute top-[5px] right-1/2 w-full h-[1.5px]', BAR[states[i - 1]])}
                />
              )}
              <span className={cn('w-[11px] h-[11px] rounded-full border-[1.5px] z-10', DOT[state])} />
              <span className={cn('font-mono text-[9.5px] uppercase tracking-[0.1em]', LABEL[state])}>
                {stage.label}
              </span>
              <span className="sr-only">
                {state === 'now' ? 'in progress' : state === 'done' ? 'complete' : state === 'failed' ? 'failed' : 'not started'}
              </span>
            </li>
          );
        })}
      </ol>

      {/* ─── The frame the app will appear in ─── */}
      <div className="flex-1 min-h-[200px] rounded-xl border border-white/[0.06] bg-[var(--bg-raised)] overflow-hidden flex flex-col">
        <div className="h-7 shrink-0 flex items-center px-2.5 border-b border-white/[0.06]">
          <span className="font-mono text-[10px] text-zinc-500 bg-white/[0.03] px-2 py-0.5 rounded">
            {previewUrl ?? 'starting…'}
          </span>
        </div>
        <div className="flex-1 grid place-items-center p-6">
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title="App preview"
              className="w-full h-full rounded-lg border-0 bg-white"
              // Same set as PreviewPanel, deliberately. The generated app is
              // untrusted code, so this surface must not quietly grant it more
              // than the panel that already frames it.
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          ) : (
            <div className="w-full max-w-sm">
              {/* A wireframe of a generic app shell, sitting exactly where the
                  real thing will render, so the eye never has to relocate when
                  the preview arrives. */}
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
