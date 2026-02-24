'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

export function LoaderScreen({ onComplete }: { onComplete: () => void }) {
  const [minimumMet, setMinimumMet] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [particles, setParticles] = useState<Array<{
    id: number;
    size: number;
    left: number;
    top: number;
    delay: number;
    color: string;
  }>>([]);

  // Generate particles on client-side only to avoid hydration mismatch
  useEffect(() => {
    setParticles(
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        size: Math.random() * 4 + 4, // 4-8px
        left: Math.random() * 100,
        top: Math.random() * 100,
        delay: Math.random() * 2,
        color: i % 2 === 0 ? 'rgba(124, 58, 237, 0.3)' : 'rgba(6, 182, 212, 0.25)',
      }))
    );
  }, []);

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Check if page is already loaded
  useEffect(() => {
    if (document.readyState === 'complete') {
      setPageReady(true);
    } else {
      const handleLoad = () => setPageReady(true);
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, []);

  // Minimum display time timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumMet(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Start exit transition when both conditions met
  useEffect(() => {
    if (minimumMet && pageReady && !isExiting) {
      setIsExiting(true);
      // Call onComplete after transition duration
      setTimeout(() => {
        onComplete();
      }, 800);
    }
  }, [minimumMet, pageReady, isExiting, onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: 'var(--bg-primary)',
        opacity: isExiting ? 0 : 1,
        transition: isExiting ? 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s' : 'none',
      }}
    >
      {/* Grid pattern background */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Floating particles */}
      <div className="absolute inset-0">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full blur-[2px]"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              background: particle.color,
              animation: prefersReducedMotion
                ? undefined
                : `float-particle 6s ease-in-out infinite`,
              animationDelay: prefersReducedMotion ? undefined : `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Logo */}
      <div className="relative z-10">
        <div
          className="relative"
          style={{
            filter:
              isExiting || prefersReducedMotion
                ? 'none'
                : 'drop-shadow(0 0 30px rgba(124, 58, 237, 0.4)) drop-shadow(0 0 60px rgba(6, 182, 212, 0.2))',
            willChange: 'transform, opacity',
            opacity: prefersReducedMotion && !isExiting ? 1 : undefined,
            animation: prefersReducedMotion
              ? undefined
              : isExiting
              ? 'logo-exit 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              : 'logo-entrance 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards, logo-breathe 2s ease-in-out 0.6s infinite',
          }}
        >
          <Image
            src="/logo.png"
            alt="DevForge"
            width={100}
            height={100}
            priority
            loading="eager"
            className="select-none"
          />
        </div>
      </div>
    </div>
  );
}
