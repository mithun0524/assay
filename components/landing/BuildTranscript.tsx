'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RiRefreshLine, RiPauseLine, RiPlayLine } from '@remixicon/react';

/**
 * The hero's thesis: a build transcript that plays itself, on a loop.
 *
 * It uses the same rail language as the real product — one rule per turn,
 * coloured by the specialist that produced it — so the landing page is the
 * product rather than a picture of it. Pick a different prompt and the whole
 * build replays for that scenario.
 */

type Turn = {
  who: string;
  hue: string;
  line: string;
  files?: string[];
  note?: { text: string; tone: 'fail' | 'pass' };
};

type Scenario = { id: string; prompt: string; turns: Turn[] };

const GREY = '#A1A1AA'; // zinc-400: zinc-500 measured 4.06:1 at 10px, under the 4.5:1 AA floor
const BLUE = '#60A5FA';
const GREEN = '#4ADE80';
const AMBER = '#FBBF24';
const RED = '#FB7185'; // rose-400, matching --agent-debugger
const EMERALD = '#34D399';
const CYAN = '#22D3EE';

const SCENARIOS: Scenario[] = [
  {
    id: 'kanban',
    prompt: 'Kanban board',
    turns: [
      { who: 'You', hue: GREY, line: 'Build a kanban board that survives a refresh' },
      { who: 'Architect', hue: BLUE, line: 'Three columns, drag between them, state in localStorage.', files: ['reading src/**'] },
      { who: 'Coder', hue: GREEN, line: 'Writing the board, the column and the persistence hook.', files: ['src/App.tsx', 'src/components/Board.tsx', 'src/hooks/useBoard.ts'] },
      { who: 'QA', hue: AMBER, line: 'Ran it. Board crashes on first drag.', note: { text: "TypeError: can't read property 'id' of undefined", tone: 'fail' } },
      { who: 'Debugger', hue: RED, line: 'Drop handler read the card before the column resolved. Fixed.', files: ['src/components/Board.tsx'] },
      { who: 'QA', hue: EMERALD, line: 'Ran it again.', note: { text: 'Build clean · drag works · state survives reload', tone: 'pass' } },
    ],
  },
  {
    id: 'dashboard',
    prompt: 'Analytics dashboard',
    turns: [
      { who: 'You', hue: GREY, line: 'An analytics dashboard with a revenue chart' },
      { who: 'Architect', hue: BLUE, line: 'Recharts for the graph, a mock data module, responsive grid.' },
      { who: 'Coder', hue: GREEN, line: 'Scaffolding the shell and the chart.', files: ['src/App.tsx', 'src/components/RevenueChart.tsx', 'package.json'] },
      { who: 'QA', hue: AMBER, line: 'Install failed before the server could start.', note: { text: 'npm ERR! 404 Not Found - GET https://registry.npmjs.org/recharts-ui', tone: 'fail' } },
      { who: 'Debugger', hue: RED, line: 'Package name was wrong. Installing recharts instead.', files: ['package.json'] },
      { who: 'QA', hue: EMERALD, line: 'Ran it again.', note: { text: 'Install clean · chart renders · no console errors', tone: 'pass' } },
    ],
  },
  {
    id: 'unknown',
    prompt: 'Unfamiliar library',
    turns: [
      { who: 'You', hue: GREY, line: 'Add file-based routing with TanStack Router v1' },
      { who: 'Assistant', hue: CYAN, line: "I don't know this API well enough to guess. Looking it up first.", files: ['searching tanstack router v1 file routes'] },
      { who: 'Architect', hue: BLUE, line: 'Route tree is generated at build time. Config goes in vite.config.', files: ['reading vite.config.ts'] },
      { who: 'Coder', hue: GREEN, line: 'Wiring the plugin and the first two routes.', files: ['vite.config.ts', 'src/routes/__root.tsx', 'src/routes/index.tsx'] },
      { who: 'QA', hue: EMERALD, line: 'Ran it.', note: { text: 'Routes resolve · navigation works · no type errors', tone: 'pass' } },
    ],
  },
];

const CHAR_MS = 14;
const TURN_GAP_MS = 380;
const LOOP_PAUSE_MS = 3200;

export function BuildTranscript() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [turnIndex, setTurnIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const [runId, setRunId] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  // Mirror into a ref for the RAF loop — assigning during render is a data race
  // React can no longer guarantee.
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const scenario = SCENARIOS[scenarioIndex];

  const pick = useCallback((i: number) => {
    setScenarioIndex(i);
    setTurnIndex(0);
    setTyped('');
    setDone(false);
    setPaused(false);
    setRunId((r) => r + 1);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only media query; reading it during render breaks hydration
      setTurnIndex(scenario.turns.length);
      setDone(true);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Pausing must hold the current frame, not tear the run down.
    const later = (fn: () => void, ms: number) => {
      const tick = () => {
        if (cancelled) return;
        if (pausedRef.current) {
          timers.push(setTimeout(tick, 120));
          return;
        }
        fn();
      };
      timers.push(setTimeout(tick, ms));
    };

    const playTurn = (i: number) => {
      if (cancelled) return;
      if (i >= scenario.turns.length) {
        setDone(true);
        // Loop into the next scenario so the hero keeps demonstrating.
        later(() => {
          setScenarioIndex((s) => (s + 1) % SCENARIOS.length);
          setTurnIndex(0);
          setTyped('');
          setDone(false);
          setRunId((r) => r + 1);
        }, LOOP_PAUSE_MS);
        return;
      }

      const text = scenario.turns[i].line;
      let c = 0;
      const type = () => {
        if (cancelled) return;
        if (pausedRef.current) {
          timers.push(setTimeout(type, 120));
          return;
        }
        c += 1;
        setTyped(text.slice(0, c));
        if (c < text.length) {
          timers.push(setTimeout(type, CHAR_MS));
        } else {
          later(() => {
            setTurnIndex(i + 1);
            setTyped('');
            playTurn(i + 1);
          }, TURN_GAP_MS);
        }
      };
      type();
    };

    later(() => playTurn(0), 500);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [scenario, runId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turnIndex, typed]);

  const visible = scenario.turns.slice(0, Math.min(turnIndex + 1, scenario.turns.length));

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0B0B0F] overflow-hidden shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-2 px-4 h-10 border-b border-white/[0.06]">
        <span className="w-2.5 h-2.5 rounded-full bg-white/[0.09]" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/[0.09]" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/[0.09]" />
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          build transcript
        </span>

        <div className="ml-auto flex items-center gap-1">
          {done && <span className="font-mono text-[10px] text-emerald-400/90 mr-1">shipped</span>}
          <button
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Resume the demo' : 'Pause the demo'}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            {paused ? <RiPlayLine className="w-3.5 h-3.5" /> : <RiPauseLine className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => pick(scenarioIndex)}
            aria-label="Replay this build"
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
          >
            <RiRefreshLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        tabIndex={0}
        role="log"
        aria-label="Example build transcript"
        className="h-[340px] sm:h-[400px] overflow-y-auto px-4 py-4 space-y-4 scroll-smooth focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
      >
        {visible.map((turn, i) => {
          const isCurrent = i === turnIndex && !done;
          const body = isCurrent ? typed : turn.line;
          return (
            <div key={`${scenario.id}-${i}`} className="min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: turn.hue }}>
                  {turn.who}
                </span>
                {isCurrent && <span className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse" aria-hidden />}
              </div>

              <div className="border-l-2 pl-3" style={{ borderColor: `${turn.hue}99` }}>
                <p className="text-[13.5px] leading-relaxed text-zinc-300">
                  {body}
                  {isCurrent && (
                    <span className="ml-0.5 inline-block w-[2px] h-[1em] align-[-0.15em] bg-zinc-400 animate-pulse" />
                  )}
                </p>

                {!isCurrent && turn.files && (
                  <div className="mt-2 space-y-1">
                    {turn.files.map((f) => (
                      <div key={f} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                        <span className="font-mono text-[11px] text-zinc-400 truncate">{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!isCurrent && turn.note && (
                  <div
                    className="mt-2 px-2.5 py-1.5 rounded-lg border font-mono text-[11px]"
                    style={
                      turn.note.tone === 'fail'
                        ? { borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.06)', color: '#FCA5A5' }
                        : { borderColor: 'rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.06)', color: '#6EE7B7' }
                    }
                  >
                    {turn.note.text}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pick a different build */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-t border-white/[0.06] overflow-x-auto">
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => pick(i)}
            aria-pressed={i === scenarioIndex}
            className={`shrink-0 px-2.5 py-1 rounded-lg font-mono text-[10px] transition-colors ${
              i === scenarioIndex
                ? 'bg-white/[0.08] text-zinc-200 border border-white/[0.1]'
                : 'text-zinc-400 border border-transparent hover:text-zinc-200 hover:bg-white/[0.04]'
            }`}
          >
            {s.prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
