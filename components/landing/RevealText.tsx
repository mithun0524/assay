'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

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
  scrollerId?: string;
  children?: ReactNode;
};

export function RevealText({
  text,
  as: Tag = 'span',
  className = '',
  stagger = 0.035,
  delay = 0,
  split = 'word',
  onScroll = false,
  scrollerId,
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
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
      const scroller = scrollerId ? document.getElementById(scrollerId) ?? undefined : undefined;
      const ctx = gsap.context(() => {
        gsap.from(units, {
          ...vars,
          // Without this, `from` hides the text immediately and only reveals it
          // when the trigger fires — so a trigger that never fires (custom
          // scroller, resize race) leaves the heading permanently invisible.
          immediateRender: false,
          scrollTrigger: { scroller, trigger: el, start: 'top 90%', once: true },
        });
      }, el);
      const sync = () => ScrollTrigger.update();
      (scroller ?? window).addEventListener('scroll', sync, { passive: true });
      cleanup = () => {
        (scroller ?? window).removeEventListener('scroll', sync);
        ctx.revert();
        gsap.set(units, { clearProps: 'transform,opacity' });
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [text, stagger, delay, onScroll, scrollerId, split]);

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
