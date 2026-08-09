'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { RevealText } from './RevealText';

/**
 * The pipeline, drawn as one continuous rail that fills as you scroll.
 *
 * The numbering is honest here: this really is a sequence, and the rail is the
 * same device the transcript uses, so the two halves of the page rhyme.
 */

const STAGES = [
  {
    id: '01',
    who: 'Architect',
    hue: '#60A5FA',
    title: 'Reads the project before planning',
    body: 'Lists the real file tree and opens what matters, instead of guessing from a truncated summary. Then it commits to a structure.',
  },
  {
    id: '02',
    who: 'Coder',
    hue: '#4ADE80',
    title: 'Writes whole files into a live sandbox',
    body: 'A real Node runtime in your browser tab. Files land as they stream, dependencies install, the dev server comes up on its own.',
  },
  {
    id: '03',
    who: 'QA',
    hue: '#FBBF24',
    title: 'Runs it before you ever see it',
    body: 'Build output, command exit codes and runtime exceptions from the live preview. If anything is broken, you do not get handed the wreckage.',
  },
  {
    id: '04',
    who: 'Debugger',
    hue: '#F87171',
    title: 'Gets the failure, not a summary',
    body: 'The exact stack trace and the file it came from, then a fix — and QA runs again. Two rounds, then it stops and tells you plainly.',
  },
  {
    id: '05',
    who: 'You',
    hue: '#E4E4E7',
    title: 'Ship it',
    body: 'Push to a GitHub repo or deploy straight to Vercel. The code is yours: plain React, no runtime lock-in, no proprietary wrapper.',
  },
];

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function PipelineRail() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<(() => void) | null>(null);

  useIsoLayoutEffect(() => {
    const section = sectionRef.current;
    const line = lineRef.current;
    if (!section || !line) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      line.style.transform = 'scaleY(1)';
      return;
    }

    // Span exactly first dot → last dot.
    const sizeRail = () => {
      const list = listRef.current;
      const dots = list?.querySelectorAll<HTMLElement>('[data-dot]');
      if (!list || !dots || dots.length < 2) return;
      const listTop = list.getBoundingClientRect().top;
      const first = dots[0].getBoundingClientRect();
      const last = dots[dots.length - 1].getBoundingClientRect();
      const top = first.top - listTop + first.height / 2;
      const height = last.top + last.height / 2 - first.top - first.height / 2;
      for (const el of [trackRef.current, line]) {
        if (!el) continue;
        el.style.top = `${top}px`;
        el.style.height = `${height}px`;
        el.style.bottom = 'auto';
      }
    };
    sizeRail();
    const ro = new ResizeObserver(() => {
      sizeRail();
      refreshRef.current?.();
    });
    ro.observe(section);

    let cleanup = () => {};

    (async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        // Scrub against the dot span. Triggering on the section meant the rail
        // was half full before the list appeared and finished while stage 5 was
        // still mid-screen — it stopped tracking exactly where it should have
        // been guiding you.
        gsap.fromTo(
          line,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              // The track spans exactly first dot → last dot, so scrubbing
              // against it makes the fill track which stage you are reading:
              // empty when stage 1 reaches the reading line, full when the
              // last one does.
              trigger: trackRef.current ?? listRef.current ?? section,
              start: 'top 45%',
              end: 'bottom 45%',
              scrub: 0.4,
            },
          }
        );

        // The stage text is never animated — it is simply there. Fading a wall
        // of prose in on scroll made the section feel like it was still
        // loading; signalling progress is the rail's job. Only the dot marks
        // arrival, and only for stages still below the fold, so nothing that
        // is already painted ever blinks.
        section.querySelectorAll<HTMLElement>('[data-stage]').forEach((el) => {
          if (el.getBoundingClientRect().top <= window.innerHeight * 0.92) return;

          const dot = el.querySelector<HTMLElement>('[data-dot]');
          if (dot) {
            gsap.from(dot, {
              scale: 0.4,
              opacity: 0.3,
              duration: 0.4,
              ease: 'back.out(2)',
              immediateRender: true,
              clearProps: 'transform,opacity',
              scrollTrigger: { trigger: el, start: 'top 90%', once: true },
            });
          }
        });
      }, section);

      // Native document scrolling — ScrollTrigger drives itself. It only
      // needed manual updates while the page scrolled inside a wrapper div.
      ScrollTrigger.refresh();
      refreshRef.current = () => ScrollTrigger.refresh();
      cleanup = () => {
        refreshRef.current = null;
        ctx.revert();
      };
    })();

    return () => {
      ro.disconnect();
      cleanup();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="relative py-24 sm:py-32 px-6 border-t border-white/[0.06]"
    >
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[22rem_1fr] gap-12 lg:gap-20">
        {/* Left column holds still while the stages scroll past it. */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 mb-3">
            One prompt, five stages
          </p>
          <RevealText
            as="h2"
            text="Every stage hands its work to the next."
            onScroll
            className="block text-3xl sm:text-[2.6rem] leading-[1.08] font-semibold tracking-[-0.035em] text-zinc-50 mb-5"
          />
          <p className="text-[15px] leading-relaxed text-zinc-400">
            And the last one checks it. If the check fails the work goes back, not forward —
            which is the whole difference between a code generator and a build.
          </p>
        </div>

        <div className="relative pl-8 sm:pl-10">
          {/* Height is measured from the first dot to the last so the rail
              starts and stops on them, instead of running past into the
              list's padding. */}
          <div ref={trackRef} className="absolute left-[7px] w-px bg-white/[0.07]" aria-hidden />
          <div
            ref={lineRef}
            className="absolute left-[7px] w-px origin-top bg-gradient-to-b from-blue-400 via-emerald-400 to-zinc-200"
            style={{ transform: 'scaleY(0)' }}
            aria-hidden
          />

          <ol ref={listRef} className="divide-y divide-white/[0.06]">
            {STAGES.map((s) => (
              <li key={s.id} data-stage className="relative py-7 first:pt-0 last:pb-0">
                <span
                  data-dot
                  className="absolute -left-8 sm:-left-10 top-[2.35rem] first:top-3 w-3.5 h-3.5 rounded-full border-2"
                  style={{ borderColor: s.hue, background: '#08080A', marginLeft: '0.5px' }}
                  aria-hidden
                />
                <div className="flex items-baseline gap-3 mb-1.5">
                  <span className="font-mono text-[11px] text-zinc-600">{s.id}</span>
                  <span
                    className="font-mono text-[11px] uppercase tracking-[0.16em]"
                    style={{ color: s.hue }}
                  >
                    {s.who}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-medium tracking-[-0.015em] text-zinc-100 mb-1.5">
                  {s.title}
                </h3>
                <p className="text-[14.5px] leading-relaxed text-zinc-400 max-w-2xl">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
