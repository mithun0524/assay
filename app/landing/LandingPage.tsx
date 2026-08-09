'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { onScrollPast } from '@/lib/motion';

import { LoaderScreen } from './LoaderScreen';
import { BuildTranscript } from '@/components/landing/BuildTranscript';
import { PipelineRail } from '@/components/landing/PipelineRail';
import { AgentRoster, ProofStrip } from '@/components/landing/AgentRoster';
import { ScrollExpand } from '@/components/landing/ScrollExpand';
import { RevealText } from '@/components/landing/RevealText';
import { ScrollVelocity } from '@/components/reactbits/ScrollVelocity';
import DecryptedText from '@/components/reactbits/DecryptedText';
import Magnet from '@/components/reactbits/Magnet';
import ClickSpark from '@/components/ClickSpark';
import {
  RiGithubLine,
  RiMenuLine,
  RiCloseLine,
  RiArrowRightLine,
} from '@remixicon/react';

/* ────────────────────────────────────────────── */
/*  Constants                                      */
/* ────────────────────────────────────────────── */

/* A `useReveal` hook and a memoised `Reveal` wrapper used to live here: an
   IntersectionObserver-per-instance scroll reveal. Neither was ever rendered —
   every heading on this page reveals through RevealText, which is GSAP. They
   were deleted rather than ported, along with components/ScrollReveal.tsx,
   which was likewise unreferenced. Scroll-linked motion is GSAP only now; the
   shared helpers live in lib/motion.ts. */

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'What you get', href: '#showcase' },
  { label: 'The agents', href: '#features' },
];




// Only what is actually implemented. The previous copy promised Netlify and
// Cloudflare deploys, custom domains and zero-config CI/CD — none of which
// exist in this codebase.
const TEMPLATE_KINDS = [
  { name: 'Dashboards', count: '2 templates', body: 'Charts, tables and a sidebar shell.' },
  { name: 'Tools', count: '4 templates', body: 'Editors, trackers and small utilities.' },
  { name: 'Marketing', count: '2 templates', body: 'Landing and SaaS pages with sections.' },
  { name: 'Commerce & blog', count: '2 templates', body: 'Product grids and post layouts.' },
];

const CAPABILITIES = [
  {
    label: 'Sandbox',
    title: 'A Node runtime inside the browser tab',
    body: 'WebContainers run npm install and your dev server locally in the page. No Docker, no remote VM, nothing to set up — and it keeps working when you are offline mid-session.',
  },
  {
    label: 'Editor',
    title: 'Monaco, a file tree and a real terminal',
    body: 'Edit anything the agents wrote, open several files at once, search across the project, and watch install and build output stream into the terminal panel.',
  },
  {
    label: 'Review',
    title: 'See every change before it lands',
    body: 'Turn on diff preview and each file the agent wants to write arrives as an accept-or-reject diff. Undo restores the snapshot taken before the agent started.',
  },
  {
    label: 'Ship',
    title: 'GitHub push and Vercel deploy',
    body: 'Create a repo and push straight from the workspace, or deploy to Vercel with your own token. Or export the project as a zip and never come back.',
  },
];




// Only destinations that exist. The old footer advertised an API reference, a
// changelog, a blog, careers and partners — twenty-odd links to nowhere, which
// is the fastest way to tell a developer the product is a shell.
const FOOTER_LINKS: Record<string, Array<{ label: string; href: string }>> = {
  Product: [
    { label: 'Open the workspace', href: '/app' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'The agents', href: '#features' },
  ],
  Source: [
    { label: 'GitHub repository', href: 'https://github.com/mithun0524/devforge' },
    { label: 'Report an issue', href: 'https://github.com/mithun0524/devforge/issues' },
  ],
  'Built on': [
    { label: 'WebContainers', href: 'https://webcontainers.io' },
    { label: 'OpenRouter', href: 'https://openrouter.ai' },
    { label: 'Supabase', href: 'https://supabase.com' },
  ],
};

/* ────────────────────────────────────────────── */
/*  Mockup sub-components                         */
/* ────────────────────────────────────────────── */


/* ────────────────────────────────────────────── */
/*  Main component                                 */
/* ────────────────────────────────────────────── */

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [heroMorphing, setHeroMorphing] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // The navbar sits over the hero's agent-hue wash, so at rest it is
  // transparent and lets the wash through; once the page moves it earns a
  // ground and a hairline. Reading scrollTop off the scroller div rather than
  // the window, because the page scrolls inside #landing-scroller, not the
  // document.
  useEffect(() => onScrollPast(24, setNavScrolled, 'landing-scroller'), []);

  const handleLoaderComplete = useCallback(() => {
    setHeroMorphing(true);
    setTimeout(() => {
      setShowLoader(false);
    }, 100);
  }, []);

  // Smooth scroll (Lenis) removed: it ran a permanent rAF loop and, worse,
  // animated every wheel event on a spring — which reads as input lag no matter
  // how high the frame rate is. Native scrolling responds immediately.
  // To bring it back, reinstate the Lenis effect here and pass the same
  // scroller id to PipelineRail / ScrollExpand / ScrollVelocity.

  return (
    <>
      {showLoader && <LoaderScreen onComplete={handleLoaderComplete} />}

      <ClickSpark
        sparkColor='#fff'
        sparkSize={10}
        sparkRadius={15}
        sparkCount={8}
        duration={400}
      >
        <div ref={scrollContainerRef} id="landing-scroller" className="h-screen overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="gradient-mesh" />

      {/* Aurora region — wraps navbar + hero */}
      <div className="relative">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {/* The agent hues, painted with CSS instead of a WebGL shader.
              Strands looked good but ran a full-screen fragment shader every
              frame; it was the single biggest cost on the page. This costs
              nothing to composite and reads almost the same at 55% opacity.

              The five radials moved into the `.agent-wash` class in globals.css
              so they are built from --agent-* rather than hardcoded rgba: the
              login page uses the same wash, and the two must not drift. */}
          <div className="absolute inset-0 opacity-55 agent-wash" />
          {/* Keep the strands off the type: solid on the left where the headline
              sits, clear on the right where the transcript is. */}
          <div className="absolute inset-0 bg-[linear-gradient(100deg,#08080A_0%,#08080A_34%,rgba(8,8,10,0.55)_52%,rgba(8,8,10,0.15)_72%,transparent_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#09090b] to-transparent" />
        </div>

      {/* ─────────── Navbar ─────────── */}
      <nav
        className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
          navScrolled
            ? 'border-white/[0.06] bg-[#09090b]/85 backdrop-blur-xl'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/landing" className="flex items-center cursor-pointer">
            <Image src="/logo-with-typo.png" alt="DevForge" width={160} height={40} className="h-9 w-auto" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer px-3 py-1.5">
              Sign In
            </Link>
            <Link href="/app" className="btn-premium text-sm px-4 py-1.5 rounded-lg cursor-pointer">
              Get Started
            </Link>
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer">
            {mobileMenuOpen ? <RiCloseLine className="w-5 h-5" /> : <RiMenuLine className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--border-subtle)] px-6 py-4 flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} onClick={() => setMobileMenuOpen(false)} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1 cursor-pointer">
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <Link href="/login" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1 cursor-pointer">Sign In</Link>
              <Link href="/app" className="btn-premium text-sm px-4 py-2 rounded-lg text-center cursor-pointer">Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─────────── Hero ─────────── */}
      <section className="relative px-6 pt-16 sm:pt-24 pb-20 overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center relative z-10">
          {/* Left: the claim */}
          <div>
            <div className="inline-flex items-center gap-2 mb-7 animate-fade-up">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <DecryptedText
                text="SIX AGENTS · ONE QA GATE"
                animateOn="view"
                sequential
                speed={38}
                revealDirection="start"
                characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·"
                parentClassName="font-mono text-[11px] uppercase tracking-[0.2em]"
                className="text-zinc-400"
                encryptedClassName="text-zinc-700"
              />
            </div>

            {heroMorphing || !showLoader ? (
              <h1 className="text-[2.4rem] leading-[1.04] sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.04em] text-zinc-50 mb-6">
                <RevealText as="span" className="block" text="Six agents build it." stagger={0.045} delay={0.15} />
                <RevealText as="span" className="block text-zinc-400" text="One agent breaks it." stagger={0.045} delay={0.32} />
                <RevealText as="span" className="block" text="You get what works." stagger={0.045} delay={0.49} />
              </h1>
            ) : (
              <h1 className="text-[2.4rem] leading-[1.04] sm:text-5xl lg:text-[3.5rem] font-semibold tracking-[-0.04em] mb-6 opacity-0">
                Six agents build it. One agent breaks it. You get what works.
              </h1>
            )}

            <p className={`text-base sm:text-[17px] leading-relaxed text-zinc-400 max-w-lg mb-9 ${showLoader ? 'opacity-0' : 'animate-fade-up delay-200'}`}>
              Describe an app. The architect plans it, the coder writes it, and the QA agent
              runs it in a real Node sandbox in your browser. Anything broken goes back to the
              debugger before it reaches you.
            </p>

            <div className={`flex flex-wrap items-center gap-3 mb-8 ${showLoader ? 'opacity-0' : 'animate-fade-up delay-300'}`}>
              <Magnet padding={90} magnetStrength={6}>
                <Link
                  href="/app"
                  className="group inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-50 text-zinc-950 text-sm font-medium transition-all hover:bg-white hover:shadow-[0_0_40px_-8px_rgba(255,255,255,0.35)]"
                >
                  Start building
                  <RiArrowRightLine className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Magnet>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/[0.08] text-sm text-zinc-300 hover:text-zinc-50 hover:border-white/20 transition-all"
              >
                See how it works
              </a>
            </div>

            <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] text-zinc-400 ${showLoader ? 'opacity-0' : 'animate-fade-up delay-400'}`}>
              <span>No install</span>
              <span>Runs in your tab</span>
              <span>Your code, plain React</span>
            </div>
          </div>

          {/* Right: the product, playing itself */}
          <div className={showLoader ? 'opacity-0' : 'animate-fade-up delay-300'}>
            <BuildTranscript />
          </div>
        </div>
      </section>
      </div>{/* end Aurora region */}

      {/* ─────────── Trusted By (marquee) ─────────── */}
      <section className="py-14 border-t border-white/[0.06] overflow-hidden">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 text-center mb-7">
          Built with
        </p>
        {/* Speed tracks the scroll, so the strip reacts instead of looping blindly. */}
        {/* The component's classNames REPLACE its stylesheet's .parallax/.scroller,
            so the layout rules have to come from here or the strip wraps into
            several rows instead of scrolling as one line. */}
        <ScrollVelocity
          scrollContainerRef={scrollContainerRef}
          texts={['WebContainers — OpenRouter — Next.js — React — TypeScript — Tailwind — Supabase — Vercel']}
          velocity={34}
          damping={60}
          stiffness={320}
          numCopies={5}
          parallaxClassName="relative w-full overflow-hidden"
          scrollerClassName="flex gap-14 whitespace-nowrap text-xl sm:text-2xl font-medium tracking-[-0.01em] text-zinc-500 [word-spacing:0.35em]"
        />
      </section>

      {/* ─────────── The workspace, revealed by scroll ─────────── */}
      {/* Real footage of a build, recorded from this app — see test/record-promo.mjs.
          The frame stays inside the section padding rather than going full-bleed. */}
      <section className="border-t border-white/[0.06] px-4 sm:px-8 lg:px-12">
        <ScrollExpand
          mediaType="video"
          src="/promo.mp4"
          poster="/promo-poster.jpg"
          alt="How a DevForge build runs: the architect plans, the coder writes files, QA finds a crash, the debugger fixes it, QA passes"
          scrollHint="Six agents · one QA gate"
          scrollerId="landing-scroller"
          stageHeight={0.82}
          startWidth={54}
          startHeight={64}
          startRadius={20}
          endRadius={18}
          mediaZoom={1}
          scrollDistance={0.9}
          holdDistance={0.3}
          overlayScrim={0.45}
          playAt={0.5}
        />
      </section>

      {/* ─────────── How It Works — scroll-drawn pipeline ─────────── */}
      <PipelineRail scrollerId="landing-scroller" />

      {/* Templates — same rail language as everything else, and only the
          categories that actually ship in lib/templates. */}
      <section className="py-24 sm:py-28 px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 mb-3">
            Or skip the prompt
          </p>
          <RevealText
            as="h2"
            text="Ten starting points, already running."
            onScroll
            scrollerId="landing-scroller"
            className="block text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-50 max-w-2xl mb-4"
          />
          <p className="text-[15px] leading-relaxed text-zinc-400 max-w-xl mb-12">
            Pick a template and it installs and boots in the sandbox before you have typed
            anything. Then describe a change and the agents take it from there.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] border border-white/[0.06] rounded-2xl overflow-hidden">
            {TEMPLATE_KINDS.map((t) => (
              <Link
                key={t.name}
                href="/app"
                className="group bg-[#0A0A0D] p-6 transition-colors hover:bg-[#0D0D12]"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-400 mb-3">
                  {t.count}
                </p>
                <h3 className="text-base font-medium text-zinc-100 mb-1.5">{t.name}</h3>
                <p className="text-[13px] leading-relaxed text-zinc-400">{t.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── Showcase — Alternating feature sections (Ribbit style) ─────────── */}
      {/* ─────────── What it does, matched to what is actually built ─────────── */}
      <section id="showcase" className="py-24 sm:py-32 px-6 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 mb-3">
            What you get
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] text-zinc-50 max-w-2xl mb-14">
            A real workspace, not a chat window with a code block in it.
          </h2>

          <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {CAPABILITIES.map((c) => (
              <div key={c.title} className="grid sm:grid-cols-[13rem_1fr] gap-4 sm:gap-10 py-8">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-400">{c.label}</p>
                </div>
                <div>
                  <h3 className="text-xl font-medium tracking-[-0.01em] text-zinc-100 mb-2">{c.title}</h3>
                  <p className="text-[15px] leading-relaxed text-zinc-400 max-w-2xl">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AgentRoster />
      <ProofStrip />

      <section id="pricing" className="relative py-28 sm:py-36 px-6 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 mb-4">
            Free while it is in the open
          </p>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.04em] text-zinc-50 mb-5 text-balance">
            Describe an app. Watch six agents argue with each other about it.
          </h2>
          <p className="text-[15px] leading-relaxed text-zinc-400 mb-10 max-w-lg mx-auto">
            Runs on free OpenRouter models, so there is no card and no trial clock.
            Bring your own key if you want a different model.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-50 text-zinc-950 text-sm font-medium transition-all hover:bg-white hover:shadow-[0_0_40px_-8px_rgba(255,255,255,0.35)]"
            >
              Start building
              <RiArrowRightLine className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://github.com/mithun0524/devforge"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/[0.08] text-sm text-zinc-300 hover:text-zinc-50 hover:border-white/20 transition-all"
            >
              <RiGithubLine className="w-4 h-4" />
              Read the source
            </a>
          </div>
          <p className="mt-8 font-mono text-[11px] text-zinc-400">
            Your code stays plain React. Push it to GitHub or deploy it to Vercel and leave.
          </p>
        </div>
      </section>

      {/* ─────────── Footer ─────────── */}
      <footer className="border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
              <div key={category}>
                <h4 className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-400 mb-4">{category}</h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                        className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)]">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-mono text-[11px] text-zinc-400">
              DevForge — an open-source AI app builder. Not a company.
            </p>
            <a
              href="https://github.com/mithun0524/devforge"
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              github.com/mithun0524/devforge
            </a>
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)] overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 py-8 sm:py-10">
            <div className="flex items-center justify-center select-none">
              <span className="font-bold tracking-tighter text-white/[0.04] text-[80px] sm:text-[140px] md:text-[220px] lg:text-[350px] leading-none">
                DevForge
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
      </ClickSpark>
    </>
  );
}
