/**
 * Motion system — one timing scale, one easing, one reduced-motion answer.
 *
 * Ownership, so two libraries never animate the same thing:
 *
 *   scroll-linked  →  GSAP + ScrollTrigger (this file)
 *   enter / hover  →  CSS, using --dur-* and --ease-out from globals.css
 *   exit           →  framer-motion AnimatePresence (modals, dropdowns only)
 *
 * GSAP is imported dynamically everywhere. It is ~70kb and only the landing
 * page and a couple of panels need it, so it must not land in the initial
 * bundle for someone who opened /app to write code.
 */

/** Seconds, matching --dur-fast / --dur-base / --dur-slow in globals.css. */
export const DUR = { fast: 0.15, base: 0.3, slow: 0.7 } as const;

/** GSAP's name for cubic-bezier(0.16, 1, 0.3, 1). */
export const EASE = 'power3.out';

/** The CSS easing, for anything driving inline styles. */
export const EASE_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Read live rather than caching at module scope: the module may be evaluated
 * during SSR, and a user can flip the OS setting mid-session.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Gsap = typeof import('gsap')['gsap'];
type ScrollTriggerStatic = typeof import('gsap/ScrollTrigger')['ScrollTrigger'];

let gsapPromise: Promise<{ gsap: Gsap; ScrollTrigger: ScrollTriggerStatic }> | null = null;

/**
 * Load GSAP + ScrollTrigger once per page, register the plugin once, and hand
 * the same promise to every caller. Registering twice is harmless but the
 * double network/parse cost is not.
 */
export async function loadGsap() {
  if (!gsapPromise) {
    gsapPromise = (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      gsap.registerPlugin(ScrollTrigger);
      return { gsap, ScrollTrigger };
    })();
  }
  return gsapPromise;
}

/**
 * The app scrolls inside a div, not the document, on both the landing page and
 * the workspace. ScrollTrigger needs that element and needs a nudge on each
 * scroll event, since it only listens to the window by default.
 */
export function resolveScroller(scrollerId?: string): HTMLElement | undefined {
  if (!scrollerId || typeof document === 'undefined') return undefined;
  return document.getElementById(scrollerId) ?? undefined;
}

export type RevealOptions = {
  /** px to travel. Negative comes from below. */
  y?: number;
  x?: number;
  /** seconds between children when `stagger` targets a list */
  stagger?: number;
  delay?: number;
  duration?: number;
  /** id of the scrolling element, when it is not the window */
  scrollerId?: string;
  /** where the trigger fires, ScrollTrigger syntax */
  start?: string;
  /** animate only the first time it enters */
  once?: boolean;
};

/**
 * Fade-and-rise one element or a set of them as they scroll into view.
 *
 * Replaces the per-component IntersectionObserver `Reveal` wrappers: those ran
 * a separate observer per instance and could not be sequenced against the
 * GSAP timelines running beside them on the same page.
 *
 * Returns a cleanup function. Call it from the effect's teardown — always,
 * including when reduced motion short-circuits, so callers need no branch.
 */
export function reveal(
  targets: Element | Element[] | NodeListOf<Element> | null,
  options: RevealOptions = {},
): () => void {
  if (!targets) return () => {};
  const list = targets instanceof Element ? [targets] : Array.from(targets);
  if (!list.length) return () => {};

  // Reduced motion: leave the elements exactly as authored. Nothing is hidden
  // by default, so there is nothing to reveal — the content is simply there.
  if (prefersReducedMotion()) return () => {};

  const {
    y = 24,
    x = 0,
    stagger = 0.08,
    delay = 0,
    duration = DUR.slow,
    scrollerId,
    start = 'top 88%',
    once = true,
  } = options;

  let cancelled = false;
  let cleanup = () => {};

  (async () => {
    const { gsap, ScrollTrigger } = await loadGsap();
    if (cancelled) return;

    const scroller = resolveScroller(scrollerId);

    const ctx = gsap.context(() => {
      gsap.from(list, {
        opacity: 0,
        y,
        x,
        duration,
        ease: EASE,
        stagger,
        delay,
        // Without this, `from` hides the targets on creation and only shows
        // them when the trigger fires. A trigger that never fires — custom
        // scroller not yet laid out, a resize race — would leave the section
        // permanently invisible. This is the single most expensive bug in
        // scroll-reveal code and it is one flag.
        immediateRender: false,
        clearProps: 'transform,opacity',
        scrollTrigger: { scroller, trigger: list[0], start, once },
      });
    });

    // ScrollTrigger listens to the window; a div scroller has to tell it.
    const sync = () => ScrollTrigger.update();
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener('scroll', sync, { passive: true });

    cleanup = () => {
      target.removeEventListener('scroll', sync);
      ctx.revert();
      gsap.set(list, { clearProps: 'transform,opacity' });
    };
  })();

  return () => {
    cancelled = true;
    cleanup();
  };
}

/**
 * Run `onChange(active)` when the scroller passes `offset` px. Used for the
 * navbar's scrolled state; kept here so it shares the one ScrollTrigger
 * instance and the one reduced-motion policy.
 *
 * This is a state toggle, not an animation, so it still runs under reduced
 * motion — the transition it drives is CSS, which globals.css collapses.
 */
export function onScrollPast(
  offset: number,
  onChange: (active: boolean) => void,
  scrollerId?: string,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const scroller = resolveScroller(scrollerId);
  const target: HTMLElement | Window = scroller ?? window;

  let last: boolean | null = null;
  const read = () => {
    const y = scroller ? scroller.scrollTop : window.scrollY;
    const active = y > offset;
    if (active !== last) {
      last = active;
      onChange(active);
    }
  };

  read();
  target.addEventListener('scroll', read, { passive: true });
  return () => target.removeEventListener('scroll', read);
}
