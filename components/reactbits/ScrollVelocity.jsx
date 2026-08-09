'use client';

import { useEffect, useRef } from 'react';
import { loadGsap, prefersReducedMotion } from '@/lib/motion';
import './ScrollVelocity.css';

/**
 * A marquee whose speed and direction track the scroll.
 *
 * Ported off framer-motion (useScroll/useVelocity/useSpring/useAnimationFrame)
 * onto GSAP's ticker, so the landing page runs one animation engine instead of
 * three. The public props are unchanged.
 *
 * Two bugs came out in the port:
 *   - VelocityText was declared inside the parent component body, so every
 *     parent render produced a new component type and React remounted the
 *     whole marquee — remeasuring width and resetting position each time.
 *   - There was no reduced-motion path at all; the strip scrolled forever
 *     regardless of the OS setting.
 */

function wrap(min, max, v) {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
}

function mapRange(value, [inMin, inMax], [outMin, outMax]) {
  if (inMax === inMin) return outMin;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/* Module scope on purpose. As an inline default this object got a fresh
   identity on every render, which re-fired the effect below every render —
   tearing down and re-adding the ticker each time. */
const DEFAULT_MAPPING = { input: [0, 1000], output: [0, 5] };

function VelocityText({
  children,
  baseVelocity = 100,
  scrollContainerRef,
  className = '',
  damping = 50,
  stiffness = 400,
  numCopies = 6,
  velocityMapping = DEFAULT_MAPPING,
  parallaxClassName = 'parallax',
  scrollerClassName = 'scroller',
  parallaxStyle,
  scrollerStyle,
}) {
  const scrollerRef = useRef(null);
  const copyRef = useRef(null);

  // Primitives, so a caller passing an inline mapping object does not restart
  // the ticker on every one of its renders.
  const [inMin, inMax] = velocityMapping?.input ?? DEFAULT_MAPPING.input;
  const [outMin, outMax] = velocityMapping?.output ?? DEFAULT_MAPPING.output;

  useEffect(() => {
    const scroller = scrollerRef.current;
    const copy = copyRef.current;
    if (!scroller || !copy) return;

    // Reduced motion: render the strip once, parked at its natural position.
    // Nothing moves and no ticker is registered.
    if (prefersReducedMotion()) return;

    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const { gsap } = await loadGsap();
      if (cancelled) return;

      let copyWidth = copy.offsetWidth;
      const ro = new ResizeObserver(() => {
        copyWidth = copy.offsetWidth;
      });
      ro.observe(copy);

      const scrollEl = scrollContainerRef?.current ?? null;
      const readY = () => (scrollEl ? scrollEl.scrollTop : window.scrollY);

      let lastY = readY();
      let smoothed = 0;
      let baseX = 0;
      let direction = 1;

      // The spring in the framer version is replaced by exponential smoothing.
      // Higher stiffness converges faster, which is the same knob it was
      // before; damping widens the window it averages over.
      const k = gsap.utils.clamp(0.02, 0.5, stiffness / 4000);
      const decay = gsap.utils.clamp(0.5, 0.99, 1 - 1 / Math.max(damping, 2));

      const input = [inMin, inMax];
      const output = [outMin, outMax];

      const tick = (_time, deltaMs) => {
        const dt = Math.min(deltaMs, 64) / 1000; // clamp tab-switch spikes
        if (dt <= 0) return;

        const y = readY();
        const raw = (y - lastY) / dt;
        lastY = y;

        smoothed = smoothed * decay + (raw - smoothed) * k;

        const factor = mapRange(smoothed, input, output);
        if (factor < 0) direction = -1;
        else if (factor > 0) direction = 1;

        let moveBy = direction * baseVelocity * dt;
        moveBy += direction * moveBy * factor;
        baseX += moveBy;

        if (copyWidth > 0) {
          gsap.set(scroller, { x: wrap(-copyWidth, 0, baseX) });
        }
      };

      gsap.ticker.add(tick);

      cleanup = () => {
        gsap.ticker.remove(tick);
        ro.disconnect();
        gsap.set(scroller, { clearProps: 'transform' });
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [baseVelocity, scrollContainerRef, damping, stiffness, inMin, inMax, outMin, outMax]);

  const spans = [];
  for (let i = 0; i < numCopies; i++) {
    spans.push(
      <span className={className} key={i} ref={i === 0 ? copyRef : null}>
        {children}&nbsp;
      </span>,
    );
  }

  return (
    <div className={parallaxClassName} style={parallaxStyle}>
      <div ref={scrollerRef} className={scrollerClassName} style={scrollerStyle}>
        {spans}
      </div>
    </div>
  );
}

/**
 * @param {{
 *   scrollContainerRef?: import('react').RefObject<HTMLElement | null>,
 *   texts?: string[],
 *   velocity?: number,
 *   className?: string,
 *   damping?: number,
 *   stiffness?: number,
 *   numCopies?: number,
 *   velocityMapping?: { input: number[], output: number[] },
 *   parallaxClassName?: string,
 *   scrollerClassName?: string,
 *   parallaxStyle?: import('react').CSSProperties,
 *   scrollerStyle?: import('react').CSSProperties,
 * }} props
 */
export const ScrollVelocity = ({
  scrollContainerRef,
  texts = /** @type {string[]} */ ([]),
  velocity = 100,
  className = '',
  damping = 50,
  stiffness = 400,
  numCopies = 6,
  velocityMapping = { input: [0, 1000], output: [0, 5] },
  parallaxClassName = 'parallax',
  scrollerClassName = 'scroller',
  parallaxStyle,
  scrollerStyle,
}) => (
  <section>
    {texts.map((text, index) => (
      <VelocityText
        key={index}
        className={className}
        baseVelocity={index % 2 !== 0 ? -velocity : velocity}
        scrollContainerRef={scrollContainerRef}
        damping={damping}
        stiffness={stiffness}
        numCopies={numCopies}
        velocityMapping={velocityMapping}
        parallaxClassName={parallaxClassName}
        scrollerClassName={scrollerClassName}
        parallaxStyle={parallaxStyle}
        scrollerStyle={scrollerStyle}
      >
        {text}
      </VelocityText>
    ))}
  </section>
);

export default ScrollVelocity;
