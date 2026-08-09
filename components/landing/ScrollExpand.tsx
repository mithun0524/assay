'use client';

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import './ScrollExpand.css';

/**
 * From React Bits, adapted for this project:
 *  - typed
 *  - reads scroll from an arbitrary ancestor scroller (this page runs Lenis on
 *    #landing-scroller, so neither `window` nor an internal scroller applies).
 *    The rect-based progress maths is unchanged — the scroller is full-height,
 *    so viewport-relative rects still line up.
 *  - honours prefers-reduced-motion by snapping instead of easing.
 */

type ScrollExpandProps = {
  src?: string;
  mediaType?: 'image' | 'video';
  poster?: string;
  alt?: string;
  title?: string;
  scrollHint?: string;
  startWidth?: number;
  startHeight?: number;
  startRadius?: number;
  endRadius?: number;
  mediaZoom?: number;
  scrollDistance?: number;
  holdDistance?: number;
  smoothing?: number;
  overlayScrim?: number;
  /** stage height as a fraction of the viewport — below 1 leaves breathing room */
  stageHeight?: number;
  /** expansion progress at which a video starts playing (0–1) */
  playAt?: number;
  enabled?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

export function ScrollExpand({
  src = '',
  mediaType = 'image',
  poster = '',
  alt = '',
  title = '',
  scrollHint = '',
  startWidth = 42,
  startHeight = 58,
  startRadius = 24,
  endRadius = 0,
  mediaZoom = 1.35,
  scrollDistance = 1.2,
  holdDistance = 0.35,
  smoothing = 0.1,
  overlayScrim = 0.45,
  stageHeight = 1,
  playAt = 0.45,
  enabled = true,
  children,
  className = '',
  style,
}: ScrollExpandProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLImageElement & HTMLVideoElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  const playAtRef = useRef(playAt);
  const prefersReducedMotionRef = useRef(false);
  useEffect(() => {
    playAtRef.current = playAt;
  }, [playAt]);

  const propsRef = useRef({
    startWidth, startHeight, startRadius, endRadius, mediaZoom,
    scrollDistance, holdDistance, smoothing, overlayScrim, enabled,
  });
  useEffect(() => {
    propsRef.current = {
      startWidth, startHeight, startRadius, endRadius, mediaZoom,
      scrollDistance, holdDistance, smoothing, overlayScrim, enabled,
    };
  }, [startWidth, startHeight, startRadius, endRadius, mediaZoom,
      scrollDistance, holdDistance, smoothing, overlayScrim, enabled]);

  const applyProgress = useCallback((p: number) => {
    const frame = frameRef.current;
    const media = mediaRef.current;
    if (!frame || !media) return;
    const c = propsRef.current;

    const e = smoothstep(0, 1, p);

    const w = c.startWidth + (100 - c.startWidth) * e;
    const h = c.startHeight + (100 - c.startHeight) * e;
    const ix = Math.max(0, (100 - w) / 2);
    const iy = Math.max(0, (100 - h) / 2);
    const r = c.startRadius + (c.endRadius - c.startRadius) * e;
    frame.style.clipPath = `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${r}px)`;

    media.style.transform = `scale(${c.mediaZoom + (1 - c.mediaZoom) * e})`;

    if (scrimRef.current) scrimRef.current.style.opacity = `${c.overlayScrim * e}`;

    if (titleRef.current) {
      const out = smoothstep(0.4, 0.88, p);
      titleRef.current.style.opacity = `${1 - out}`;
      titleRef.current.style.transform = `translate3d(0, ${-28 * out}px, 0) scale(${1 + 0.06 * out})`;
    }

    if (hintRef.current) {
      const gone = smoothstep(0, 0.12, p);
      hintRef.current.style.opacity = `${1 - gone}`;
      hintRef.current.style.transform = `translate3d(0, ${8 * gone}px, 0)`;
    }

    if (overlayRef.current) {
      const inn = smoothstep(0.68, 1, p);
      overlayRef.current.style.opacity = `${inn}`;
      overlayRef.current.style.transform = `translate3d(0, ${18 * (1 - inn)}px, 0)`;
    }

    // Hold the poster until the frame is genuinely opening, so the film starts
    // from frame one when it is actually on screen — not while it is a thumbnail.
    const video = media as HTMLVideoElement;
    if (typeof video.play === 'function' && !prefersReducedMotionRef.current) {
      if (p >= playAtRef.current) {
        if (video.paused) void video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
        video.currentTime = 0;
      }
    }
  }, []);

  // A looping video is motion too — reduced motion keeps the poster frame.
  useEffect(() => {
    prefersReducedMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const v = mediaRef.current;
    if (!v || mediaType !== 'video') return;
    if (prefersReducedMotionRef.current) v.pause();
  }, [mediaType]);

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!root || !track || !stage) return;

    const scroller: Window = window;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let current = 0;
    let target = 0;
    let stageH = 0;
    let running = false;

    const measure = () => {
      const c = propsRef.current;
      // Fractional stage keeps the expanded frame inside the section's padding
      // instead of going edge-to-edge.
      stageH = Math.round(window.innerHeight * clamp(stageHeight, 0.4, 1));
      if (stageH <= 0) return;
      stage.style.height = `${stageH}px`;
      // Sticky stages pin to the top by default, which leaves the shortfall as
      // dead space at the bottom. Offset by half so the frame sits centred.
      stage.style.top = `${Math.max(0, Math.round((window.innerHeight - stageH) / 2))}px`;
      track.style.height = `${stageH * (1 + Math.max(0, c.scrollDistance) + Math.max(0, c.holdDistance))}px`;
      const w = root.clientWidth || stageH;
      stage.style.setProperty('--se-title-size', `${clamp(w * 0.038, 20, 46)}px`);
    };

    const readProgress = () => {
      const c = propsRef.current;
      if (!c.enabled) return 1;
      const span = stageH * Math.max(0.01, c.scrollDistance);
      const top = track.getBoundingClientRect().top;
      return clamp(-top / span, 0, 1);
    };

    const tick = () => {
      const c = propsRef.current;
      const k = c.smoothing <= 0 ? 1 : 1 - Math.exp(-1 / (60 * c.smoothing));
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.0004) {
        current = target;
        running = false;
      }
      applyProgress(current);
      raf = running ? requestAnimationFrame(tick) : 0;
    };

    const kick = () => {
      if (running) return;
      running = true;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      target = readProgress();
      if (propsRef.current.smoothing <= 0 || reduceMotion) {
        current = target;
        applyProgress(current);
        return;
      }
      kick();
    };

    const onResize = () => {
      measure();
      target = readProgress();
      current = target;
      applyProgress(current);
    };

    measure();
    target = readProgress();
    current = target;
    applyProgress(current);

    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    // Decoding a video that is nowhere near the viewport is pure waste.
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = mediaRef.current as HTMLVideoElement | null;
        if (!v || typeof v.play !== 'function') return;
        if (!entry.isIntersecting && !v.paused) v.pause();
        else if (entry.isIntersecting && current >= playAtRef.current && v.paused) {
          void v.play().catch(() => {});
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      io.disconnect();
    };
  }, [applyProgress, stageHeight]);

  const media =
    mediaType === 'video' ? (
      <video
        ref={mediaRef}
        className="scroll-expand__media"
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={alt}
      >
        <source src={src} type="video/mp4" />
        {/* VP9 fallback for browsers without h264 */}
        <source src={src.replace(/\.mp4$/, '.webm')} type="video/webm" />
      </video>
    ) : (
      /* eslint-disable-next-line @next/next/no-img-element -- the component animates transform on the element directly */
      <img ref={mediaRef} className="scroll-expand__media" src={src} alt={alt} draggable={false} />
    );

  return (
    <div ref={rootRef} className={`scroll-expand ${className}`.trim()} style={style}>
      <div ref={trackRef} className="scroll-expand__track">
        <div ref={stageRef} className="scroll-expand__stage">
          <div ref={frameRef} className="scroll-expand__frame">
            {media}
            <div ref={scrimRef} className="scroll-expand__scrim" />
            {children ? (
              <div ref={overlayRef} className="scroll-expand__overlay">
                {children}
              </div>
            ) : null}
          </div>
          {title ? (
            <div ref={titleRef} className="scroll-expand__title">
              {/* The frame's scrim only fades in as it expands, so the resting
                  title needs its own plate to stay readable over the media. */}
              <span className="scroll-expand__title-plate">{title}</span>
            </div>
          ) : null}
          {scrollHint ? (
            <div ref={hintRef} className="scroll-expand__hint">
              {scrollHint}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ScrollExpand;
