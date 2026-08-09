'use client';

import { useEffect, useLayoutEffect, useRef, type ElementType, type ReactNode } from 'react';

/**
 * GSAP word/char reveal. Splitting is done here rather than with the paid
 * SplitText plugin: each word becomes an overflow-hidden span whose inner span
 * rises into place, so the headline assembles itself line by line.
 *
 * Reduced motion renders the text plainly and never animates.
 */

type RevealTextProps = {
  text: string;
  as?: ElementType;
  className?: string;
  /** stagger between units, seconds */
  stagger?: number;
  delay?: number;
  split?: 'word' | 'char';
  /** animate when scrolled into view instead of on mount */
  onScroll?: boolean;
  children?: ReactNode;
};

// Runs before paint on the client, so the start-state is set without a flash.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function RevealText({
  text,
  as: Tag = 'span',
  className = '',
  stagger = 0.035,
  delay = 0,
  split = 'word',
  onScroll = false,
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const units = el.querySelectorAll<HTMLElement>('[data-unit] > span');
    if (!units.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const { gsap } = await import('gsap');
      if (cancelled) return;

      // gsap.from() animates *towards* the element's natural state, and
      // clearProps strips the inline styles afterwards. If the tween is ever
      // interrupted — StrictMode's double-mount does exactly that — the text
      // still ends up readable instead of stuck mid-flight.
      const vars = {
        yPercent: 112,
        opacity: 0,
        duration: 0.9,
        ease: 'expo.out',
        stagger,
        delay,
        clearProps: 'transform,opacity',
      };

      // Anything already on screen when this mounts must stay put. Animating it
      // would mean showing the text, hiding it, then revealing it again — the
      // flash `immediateRender: false` causes on its own.
      const belowFold = el.getBoundingClientRect().top > window.innerHeight * 0.9;

      if (!onScroll) {
        const tween = gsap.from(units, vars);
        cleanup = () => {
          tween.kill();
          gsap.set(units, { clearProps: 'transform,opacity' });
        };
        return;
      }

      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      if (!belowFold) return; // already visible — leave it alone

      const ctx = gsap.context(() => {
        // immediateRender applies the hidden start-state now, before this
        // off-screen element is ever painted, so there is nothing to flash.
        gsap.from(units, {
          ...vars,
          immediateRender: true,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      }, el);
      cleanup = () => {
        ctx.revert();
        gsap.set(units, { clearProps: 'transform,opacity' });
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [text, stagger, delay, onScroll, split]);

  const units =
    split === 'char'
      ? Array.from(text).map((c) => (c === ' ' ? ' ' : c))
      : text.split(' ');

  return (
    <Tag ref={ref} className={className}>
      {/* Screen readers get the sentence once; the split units are decorative.
          aria-label on a plain span is invalid, so use real text instead. */}
      <span className="sr-only">{text}</span>
      {units.map((unit, i) => (
        <span
          key={`${unit}-${i}`}
          data-unit
          aria-hidden
          className="inline-block overflow-hidden align-bottom"
        >
          <span className="inline-block will-change-transform">{unit}</span>
          {split === 'word' && i < units.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}
