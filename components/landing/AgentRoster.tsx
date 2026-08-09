'use client';

import { useState } from 'react';
import CountUp from '@/components/reactbits/CountUp';
import { RevealText } from './RevealText';

/**
 * The roster. The old features grid listed generic capabilities every builder
 * claims ("AI Code Generation", "Live Preview"); the actual product is a team
 * of six specialists, so the section shows the team. Colours are the same ones
 * the app uses in the chat transcript, so the palette teaches the product.
 */

const AGENTS = [
  {
    role: 'Architect',
    hue: '#60A5FA',
    tagline: 'Plans the structure',
    detail: 'Lists the real file tree and reads what matters before committing to a shape. Takes every cold start, so a new project gets a plan rather than a guess.',
    model: 'Nemotron 3 Ultra 550B',
  },
  {
    role: 'Coder',
    hue: '#4ADE80',
    tagline: 'Writes the files',
    detail: 'Streams whole files into the sandbox — never diffs, never "// rest of code". Installs what it adds, and reads a file before editing it.',
    model: 'Nemotron 3 Ultra 550B',
  },
  {
    role: 'Designer',
    hue: '#C084FC',
    tagline: 'Handles the look',
    detail: 'Takes styling, layout and animation requests. Reads the component first so a visual change never quietly drops behaviour.',
    model: 'Nemotron 3 Ultra 550B',
  },
  {
    role: 'QA',
    hue: '#FBBF24',
    tagline: 'Breaks it on purpose',
    detail: 'Waits for the sandbox to settle, then collects build output, command exit codes and runtime exceptions from the live preview. Nothing ships past it unchecked.',
    model: 'Ling 3.0 Flash',
  },
  {
    role: 'Debugger',
    hue: '#F87171',
    tagline: 'Fixes what QA finds',
    detail: 'Receives the exact stack trace and the file it came from — not a summary. Fixes the root cause, then QA runs again. Two rounds, then it stops and says so.',
    model: 'Laguna S 2.1',
  },
  {
    role: 'Assistant',
    hue: '#22D3EE',
    tagline: 'Answers questions',
    detail: 'Reads your actual files to answer questions about your project, and searches the web when the answer is outside what it knows.',
    model: 'Ling 3.0 Flash',
  },
];

export function AgentRoster() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section id="features" className="py-24 sm:py-32 px-6 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 mb-3">
          The roster
        </p>
        <RevealText
          as="h2"
          text="Six specialists, not one general-purpose bot."
          onScroll
          className="block text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-50 max-w-2xl mb-4"
        />
        <p className="text-[15px] leading-relaxed text-zinc-400 max-w-xl mb-14">
          Each message is routed to the agent whose job it is, on the model that suits
          that job. You can see which one is working at any moment — and override the
          model any time.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
          {AGENTS.map((a) => (
            <button
              key={a.role}
              onMouseEnter={() => setActive(a.role)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(a.role)}
              onBlur={() => setActive(null)}
              className="group relative text-left bg-[#0A0A0D] p-6 transition-colors hover:bg-[#0D0D12] focus:bg-[#0D0D12] focus:outline-none"
            >
              <span
                className="absolute left-0 top-0 h-full w-[2px] transition-opacity duration-300"
                style={{ background: a.hue, opacity: active === a.role ? 1 : 0.28 }}
                aria-hidden
              />
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: a.hue }}>
                  {a.role}
                </span>
              </div>
              <h3 className="text-lg font-medium tracking-[-0.01em] text-zinc-100 mb-2">{a.tagline}</h3>
              <p className="text-[13.5px] leading-relaxed text-zinc-400">{a.detail}</p>
              <p className="mt-4 font-mono text-[10px] text-zinc-600">{a.model}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Numbers that are true. The previous version claimed 10K+ apps, 50K+ active
 * developers and a 99.9% uptime SLA — none of which this product can support.
 * Everything here is checkable in the repo.
 */
const FACTS = [
  { value: 6, label: 'specialist agents', note: 'routed per message' },
  { value: 2, label: 'auto-fix rounds', note: 'before it asks you' },
  { value: 0, label: 'local install', note: 'Node runs in the tab' },
  { value: 3, label: 'free models', note: 'no card required' },
];

export function ProofStrip() {
  return (
    <section className="py-16 px-6 border-t border-white/[0.06]">
      <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
        {FACTS.map((f) => (
          <div key={f.label}>
            <div className="text-4xl font-semibold tracking-[-0.04em] text-zinc-100 mb-1">
              <CountUp to={f.value} duration={1.1} />
            </div>
            <div className="text-[13.5px] text-zinc-300">{f.label}</div>
            <div className="font-mono text-[11px] text-zinc-600 mt-0.5">{f.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
