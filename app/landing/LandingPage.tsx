'use client';

import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode, memo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const Aurora = dynamic(() => import('@/components/Aurora'), { ssr: false });
const LoaderScreen = dynamic(() => import('./LoaderScreen').then(mod => ({ default: mod.LoaderScreen })), { ssr: false });
import BlurText from '@/components/BlurText';
import ClickSpark from '@/components/ClickSpark';
import {
  RiCodeSSlashLine,
  RiEyeLine,
  RiFileList3Line,
  RiRocketLine,
  RiGithubLine,
  RiSearchLine,
  RiMenuLine,
  RiCloseLine,
  RiArrowRightLine,
  RiMagicLine,
  RiTerminalLine,
  RiFlashlightLine,
  RiTimeLine,
  RiShieldCheckLine,
  RiTeamLine,
  RiGlobalLine,
  RiCheckLine,
  RiLayoutGridLine,
  RiPaintBrushLine,
  RiDatabase2Line,
  RiCloudLine,
} from '@remixicon/react';

/* ────────────────────────────────────────────── */
/*  Scroll-reveal hook                             */
/* ────────────────────────────────────────────── */

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

const Reveal = memo(({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}) => {
  const { ref, visible } = useReveal(0.1);

  const dirMap = useMemo(() => ({
    up: 'translate-y-8',
    down: '-translate-y-8',
    left: 'translate-x-8',
    right: '-translate-x-8',
    none: '',
  }), []);

  const style = useMemo(() => ({ transitionDelay: `${delay}ms` }), [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${dirMap[direction]}`
      } ${className}`}
      style={style}
    >
      {children}
    </div>
  );
});
Reveal.displayName = 'Reveal';

/* ────────────────────────────────────────────── */
/*  Constants                                      */
/* ────────────────────────────────────────────── */

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Showcase', href: '#showcase' },
  { label: 'Pricing', href: '#pricing' },
];

const TRUSTED_BY = [
  'Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'Supabase', 'Vercel', 'OpenRouter', 'WebContainers',
];

const HOW_IT_WORKS = [
  {
    icon: RiTerminalLine,
    title: 'Describe Your App with a Prompt',
    description:
      'Simply type what you want to build — a landing page, a dashboard, an API. DevForge understands natural language and turns it into a detailed build plan.',
    mockup: 'prompt',
  },
  {
    icon: RiCodeSSlashLine,
    title: 'AI Generates Multi-file Code',
    description:
      'Our AI writes clean, production-ready code across multiple files — React components, API routes, styles, and configuration — all wired together.',
    mockup: 'code',
  },
  {
    icon: RiEyeLine,
    title: 'Live Preview in Your Browser',
    description:
      'Every project runs instantly in a sandboxed environment with hot reloading. See your app come to life in real time — zero local setup required.',
    mockup: 'preview',
  },
  {
    icon: RiRocketLine,
    title: 'Deploy to Production in One Click',
    description:
      'Push to GitHub, deploy to Vercel, Netlify, or Cloudflare. Your app goes from idea to production URL in minutes, not days.',
    mockup: 'deploy',
  },
];

const APP_TEMPLATES = [
  { icon: RiLayoutGridLine, name: 'Dashboard', description: 'Admin panels with charts, tables, and data visualization.' },
  { icon: RiGlobalLine, name: 'Landing Page', description: 'Marketing pages with hero sections, features, and CTAs.' },
  { icon: RiDatabase2Line, name: 'CRUD App', description: 'Full-stack apps with database, API routes, and forms.' },
  { icon: RiPaintBrushLine, name: 'Portfolio', description: 'Personal sites with project showcases and contact forms.' },
  { icon: RiCloudLine, name: 'SaaS Starter', description: 'Auth, billing, dashboards — everything to launch a SaaS.' },
  { icon: RiFileList3Line, name: 'Blog', description: 'Markdown-powered blogs with syntax highlighting and SEO.' },
];

const SHOWCASE_FEATURES = [
  {
    badge: 'AI-Powered Editor',
    title: 'Generate AI-powered code — in 1 click.',
    description:
      'Our AI understands your intent and generates complete, working code across multiple files. From React components to API routes, describe it and DevForge builds it instantly.',
    points: [
      'Natural language to production code',
      'Multi-file scaffolding in seconds',
      'Smart dependency management',
      'Context-aware code completion',
    ],
    cta: 'Try the Editor',
  },
  {
    badge: 'Live Preview',
    title: 'Instant preview with hot reloading.',
    description:
      'Every project runs in a sandboxed WebContainer environment. See your changes reflected in real-time with zero configuration — no Docker, no local setup, no waiting.',
    points: [
      'Real-time hot reload preview',
      'Sandboxed WebContainer execution',
      'Built-in dev server & console output',
      'Mobile-responsive preview modes',
    ],
    cta: 'See It Live',
  },
  {
    badge: 'One-Click Deploy',
    title: 'Ship to production in seconds.',
    description:
      'Deploy your app to Vercel, Netlify, or Cloudflare with a single click. Push to GitHub with built-in version control. No CI/CD configuration needed.',
    points: [
      'Deploy to Vercel, Netlify, Cloudflare',
      'Automatic GitHub repository creation',
      'Custom domain support',
      'Zero-config CI/CD pipeline',
    ],
    cta: 'Deploy Now',
  },
];

const FEATURES = [
  {
    icon: RiMagicLine,
    title: 'AI Code Generation',
    description: 'Describe what you want in plain English and watch as production-ready code is generated instantly.',
  },
  {
    icon: RiEyeLine,
    title: 'Live Preview',
    description: 'See your changes in real-time with an integrated browser preview that updates as you build.',
  },
  {
    icon: RiFileList3Line,
    title: 'Multi-file Editor',
    description: 'Work across multiple files with a full-featured code editor, file tree, and syntax highlighting.',
  },
  {
    icon: RiRocketLine,
    title: 'One-Click Deploy',
    description: 'Deploy to Vercel, Netlify, or Cloudflare with a single click. No configuration needed.',
  },
  {
    icon: RiGithubLine,
    title: 'GitHub Integration',
    description: 'Push your projects directly to GitHub repositories. Version control built right in.',
  },
  {
    icon: RiSearchLine,
    title: 'Smart Search',
    description: 'Find anything across your entire project with intelligent search and file navigation.',
  },
];

const STATS = [
  { value: '10K+', label: 'Apps Built' },
  { value: '50K+', label: 'Active Developers' },
  { value: '166%', label: 'Faster Development' },
  { value: '99.9%', label: 'Uptime SLA' },
];

const TESTIMONIALS = [
  {
    quote: 'DevForge completely changed how I prototype. What used to take days now takes minutes. The AI understands exactly what I need.',
    name: 'Sarah Chen',
    role: 'Frontend Developer',
    company: 'Vercel',
  },
  {
    quote: 'The AI code generation is surprisingly good. It understands context and writes clean, deployable code. Best tool in my workflow.',
    name: 'Marcus Rivera',
    role: 'Full-Stack Engineer',
    company: 'Stripe',
  },
  {
    quote: 'One-click deploy to Vercel is a game changer. I ship side projects faster than ever before. DevForge is the future.',
    name: 'Aisha Patel',
    role: 'Indie Hacker',
    company: 'ProductHunt',
  },
];

const FOOTER_LINKS = {
  Platform: ['AI Code Editor', 'Live Preview', 'One-Click Deploy', 'GitHub Sync', 'Multi-file Support'],
  Resources: ['Documentation', 'API Reference', 'Templates', 'Blog', 'Changelog'],
  Developers: ['Getting Started', 'Guides', 'Examples', 'Community', 'Open Source'],
  Company: ['About', 'Careers', 'Contact', 'Press', 'Partners'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Security'],
};

/* ────────────────────────────────────────────── */
/*  Mockup sub-components                         */
/* ────────────────────────────────────────────── */

const WindowChrome = memo(({ title }: { title: string }) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-black/20">
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
      </div>
      <span className="text-[11px] text-zinc-500 ml-2">{title}</span>
    </div>
  );
});
WindowChrome.displayName = 'WindowChrome';

const MockupCard = memo(({ type, title }: { type: string; title: string }) => {
  return (
    <div className="relative glass rounded-xl overflow-hidden border border-[var(--border-subtle)]">
      <WindowChrome title={title} />
      <div className="p-5 h-48 sm:h-56">
        {type === 'prompt' && (
          <div className="space-y-3">
            <div className="glass rounded-lg p-3 border border-[var(--border-subtle)]">
              <div className="text-[10px] text-zinc-600 mb-2">Prompt</div>
              <div className="text-xs text-zinc-400">Build a task manager app with drag-and-drop, dark theme, and local storage...</div>
              <div className="cursor-blink mt-1" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['React', 'TypeScript', 'Tailwind'].map((t) => (
                <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-violet-600/15 text-violet-400 border border-violet-500/20">{t}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1.5 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500" />
              </div>
              <span className="text-[10px] text-zinc-500">Generating...</span>
            </div>
          </div>
        )}
        {type === 'code' && (
          <div className="font-mono text-[11px] leading-relaxed text-zinc-500 space-y-0.5">
            <div><span className="text-violet-400">import</span> {'{'} useState {'}'} <span className="text-violet-400">from</span> <span className="text-green-400">&apos;react&apos;</span>;</div>
            <div><span className="text-violet-400">import</span> {'{'} DndContext {'}'} <span className="text-violet-400">from</span> <span className="text-green-400">&apos;@dnd-kit/core&apos;</span>;</div>
            <div />
            <div><span className="text-violet-400">export default</span> <span className="text-cyan-400">function</span> <span className="text-zinc-300">TaskBoard</span>() {'{'}</div>
            <div className="pl-4"><span className="text-violet-400">const</span> [tasks, setTasks] = <span className="text-cyan-400">useState</span>([]);</div>
            <div className="pl-4"><span className="text-violet-400">const</span> [columns] = <span className="text-cyan-400">useState</span>({'{'}...{'}'});</div>
            <div />
            <div className="pl-4"><span className="text-violet-400">return</span> (</div>
            <div className="pl-8">&lt;<span className="text-cyan-400">DndContext</span>&gt;</div>
            <div className="pl-12">&lt;<span className="text-cyan-400">div</span> <span className="text-zinc-400">className</span>=<span className="text-green-400">&quot;board&quot;</span>&gt;</div>
            <div className="pl-12 text-zinc-600">{'  '}...</div>
          </div>
        )}
        {type === 'preview' && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-full glass rounded-lg p-3 border border-[var(--border-subtle)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-zinc-300">Task Board</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-600/20 text-violet-400">3 tasks</span>
              </div>
              <div className="flex gap-2">
                {['To Do', 'In Progress', 'Done'].map((col) => (
                  <div key={col} className="flex-1 rounded bg-black/20 p-1.5">
                    <div className="text-[9px] text-zinc-600 mb-1">{col}</div>
                    <div className="h-4 rounded bg-white/[0.03] mb-1" />
                    {col === 'To Do' && <div className="h-4 rounded bg-white/[0.03]" />}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Live — localhost:3000
            </div>
          </div>
        )}
        {type === 'deploy' && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <RiCheckLine className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="text-sm font-medium text-zinc-300">Deployed Successfully</div>
            <div className="text-[11px] text-violet-400 font-mono">my-app.vercel.app</div>
            <div className="flex gap-2 mt-1">
              {['Vercel', 'GitHub'].map((p) => (
                <span key={p} className="px-2 py-0.5 rounded text-[10px] bg-white/[0.03] text-zinc-500 border border-[var(--border-subtle)]">{p}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
MockupCard.displayName = 'MockupCard';

/* ────────────────────────────────────────────── */
/*  Main component                                 */
/* ────────────────────────────────────────────── */

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [heroMorphing, setHeroMorphing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleLoaderComplete = useCallback(() => {
    setHeroMorphing(true);
    setTimeout(() => {
      setShowLoader(false);
    }, 100);
  }, []);

  useEffect(() => {
    if (!scrollContainerRef.current || showLoader) return;

    const lenis = new Lenis({
      wrapper: scrollContainerRef.current,
      content: scrollContainerRef.current,
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [showLoader]);

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
        <div ref={scrollContainerRef} className="h-screen overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="gradient-mesh" />

      {/* Aurora region — wraps navbar + hero */}
      <div className="relative">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <Aurora
            colorStops={['#7c3aed', '#06b6d4', '#7c3aed']}
            amplitude={1.2}
            blend={0.6}
            speed={0.5}
          />
        </div>

      {/* ─────────── Navbar ─────────── */}
      <nav className="sticky top-0 z-50 glass border-b border-[var(--border-subtle)]">
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
      <section className="relative pt-20 sm:pt-28 pb-0 px-6 overflow-hidden">

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs text-[var(--text-secondary)] mb-8 animate-fade-up">
            <Image src="/logo.png" alt="" width={16} height={16} className="w-4 h-4 rounded-sm" />
            Build apps in minutes
          </div>

          {heroMorphing ? (
            <div className="mb-6 text-center">
              <BlurText
                text="Build Ambitious Apps"
                delay={50}
                animateBy="words"
                direction="bottom"
                className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.08] justify-center"
              />
              <div className="mt-2 pointer-events-none" style={{ color: '#a78bfa' }}>
                <BlurText
                  text="With AI"
                  delay={50}
                  animateBy="words"
                  direction="bottom"
                  className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.08] justify-center"
                />
              </div>
            </div>
          ) : showLoader ? (
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6 opacity-0">
              Build Ambitious Apps
              <br />
              <span className="gradient-text">With AI</span>
            </h1>
          ) : (
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6 animate-fade-up delay-100">
              Build Ambitious Apps
              <br />
              <span className="gradient-text">With AI</span>
            </h1>
          )}

          <p className={`text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 ${
            showLoader ? 'opacity-0' : 'animate-fade-up delay-200'
          }`}>
            DevForge turns your ideas into production-ready web applications.
            Describe what you want, and AI handles the code, dependencies, and deployment.
          </p>

          {/* Prompt input mockup (Ribbit-style) */}
          <div className={`max-w-xl mx-auto mb-6 ${
            showLoader ? 'opacity-0' : 'animate-fade-up delay-300'
          }`}>
            <div className="glass rounded-xl p-1.5 border border-[var(--border-subtle)] flex items-center gap-2">
              <input
                type="text"
                readOnly
                placeholder="Describe the app you want to build..."
                className="flex-1 bg-transparent text-sm text-[var(--text-secondary)] placeholder:text-zinc-600 px-4 py-2.5 outline-none cursor-text"
              />
              <Link
                href="/app"
                className="shrink-0 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all hover:shadow-[0_0_24px_-4px_rgba(124,58,237,0.5)] cursor-pointer"
              >
                Start Building
              </Link>
            </div>
          </div>

          {/* Category pills */}
          <div className={`flex flex-wrap items-center justify-center gap-2 mb-16 ${
            showLoader ? 'opacity-0' : 'animate-fade-up delay-400'
          }`}>
            {['Dashboard', 'Landing Page', 'SaaS App', 'Portfolio', 'E-Commerce', 'Blog'].map((cat) => (
              <span key={cat} className="px-3 py-1 rounded-full text-xs text-zinc-500 border border-[var(--border-subtle)] hover:border-zinc-600 hover:text-zinc-300 transition-all cursor-pointer">
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Hero image */}
        <div className={`relative max-w-6xl mx-auto ${
          showLoader ? 'opacity-0' : 'animate-fade-up delay-500'
        }`} style={{ bottom: '-28px' }}>
          <div
            className="relative rounded-t-[38px] rounded-b-none overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #1a103d 0%, #130d2b 30%, #0d0b1a 60%, #09090b 100%)' }}
          >
            <Image
              src="/landing-hero.png"
              alt="DevForge — AI-powered app builder showing multiple generated applications"
              width={1920}
              height={1080}
              className="w-full h-auto"
              priority
            />
          </div>
        </div>
      </section>
      </div>{/* end Aurora region */}

      {/* ─────────── Trusted By (marquee) ─────────── */}
      <section className="py-16 border-t border-[var(--border-subtle)] overflow-hidden">
        <Reveal>
          <p className="text-sm text-[var(--text-muted)] text-center mb-8">
            Trusted by developers &middot; Built with modern technologies
          </p>
        </Reveal>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />
          <div className="flex w-max marquee">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0">
                {TRUSTED_BY.map((tech) => (
                  <span
                    key={`${tech}-${copy}`}
                    className="shrink-0 mx-8 sm:mx-12 text-sm sm:text-base font-medium text-zinc-500 whitespace-nowrap"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── How It Works (2×2 visual grid — Ribbit style) ─────────── */}
      <section id="how-it-works" className="py-24 px-6 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-[var(--text-secondary)] mb-4">
                <RiTerminalLine className="w-3.5 h-3.5 text-violet-400" />
                How It Works
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-center mb-4">
              How our AI builder works
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto text-center mb-16">
              Go from idea to deployed application in four simple steps. No setup, no configuration, no waiting.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} delay={i * 120}>
                  <div className="glass rounded-xl overflow-hidden border border-[var(--border-subtle)] glow-hover">
                    <MockupCard type={step.mockup} title={`DevForge — Step ${i + 1}`} />
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-violet-400" />
                        </div>
                        <h3 className="text-sm font-semibold">{step.title}</h3>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────── App Templates (horizontal scroll — Ribbit style) ─────────── */}
      <section className="py-24 px-6 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-[var(--text-secondary)] mb-4">
                <RiLayoutGridLine className="w-3.5 h-3.5 text-violet-400" />
                Templates
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-center mb-4">
              Pre-built templates for<br />every use case
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto text-center mb-16">
              Start from a template and customize with AI. Every template is production-ready with best practices baked in.
            </p>
          </Reveal>

          <div className="relative overflow-hidden -mx-6">
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--bg-primary)] to-transparent z-10 pointer-events-none" />
            <div className="group/marquee flex w-max marquee-slow">
              {[0, 1].map((copy) => (
                <div key={copy} className="flex shrink-0 gap-4 px-2">
                  {APP_TEMPLATES.map((tmpl) => {
                    const Icon = tmpl.icon;
                    return (
                      <div
                        key={`${tmpl.name}-${copy}`}
                        className="glass rounded-xl p-6 w-[260px] sm:w-[280px] border border-[var(--border-subtle)] glow-hover cursor-pointer flex flex-col shrink-0 transition-all duration-300 group-hover/marquee:grayscale group-hover/marquee:opacity-50 hover:!grayscale-0 hover:!opacity-100"
                      >
                        <div className="w-10 h-10 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-4">
                          <Icon className="w-5 h-5 text-violet-400" />
                        </div>
                        <h3 className="text-sm font-semibold mb-2">{tmpl.name}</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4 flex-1">
                          {tmpl.description}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors cursor-pointer">
                          Use Template <RiArrowRightLine className="w-3 h-3" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── Showcase — Alternating feature sections (Ribbit style) ─────────── */}
      <section id="showcase" className="py-24 px-6 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-[var(--text-secondary)] mb-4">
                <Image src="/logo.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
                Why DevForge
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-center mb-4">
              Why wait to take advantage?
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto text-center mb-20">
              Our users go from idea to live app faster than any traditional workflow.
            </p>
          </Reveal>

          <div className="flex flex-col gap-32">
            {SHOWCASE_FEATURES.map((item, idx) => (
              <div
                key={item.title}
                className={`flex flex-col ${idx % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 lg:gap-16 items-center`}
              >
                {/* Text */}
                <Reveal direction={idx % 2 === 0 ? 'left' : 'right'} className="flex-1 min-w-0">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-[var(--text-secondary)] mb-5">
                    <Image src="/logo.png" alt="" width={12} height={12} className="w-3 h-3 rounded-sm" loading="lazy" />
                    {item.badge}
                  </div>
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-5 leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                    {item.description}
                  </p>
                  <ul className="space-y-3 mb-8">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                        <span className="w-5 h-5 rounded-full bg-violet-600/15 border border-violet-500/30 flex items-center justify-center shrink-0">
                          <RiCheckLine className="w-3 h-3 text-violet-400" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-4">
                    <Link
                      href="/app"
                      className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all hover:shadow-[0_0_24px_-4px_rgba(124,58,237,0.5)] cursor-pointer"
                    >
                      {item.cta}
                    </Link>
                    <a href="#how-it-works" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                      Learn more &rarr;
                    </a>
                  </div>
                </Reveal>

                {/* Visual mockup */}
                <Reveal direction={idx % 2 === 0 ? 'right' : 'left'} delay={150} className="flex-1 min-w-0 w-full">
                  <div className="relative">
                    <div className="absolute -inset-4 bg-violet-600/8 rounded-2xl blur-2xl pointer-events-none" />
                    <div className="relative glass rounded-xl overflow-hidden border border-[var(--border-subtle)]">
                      <WindowChrome title={`DevForge — ${item.badge}`} />
                      <div className="p-6 h-64 sm:h-80">
                        {idx === 0 && (
                          <div className="font-mono text-[11px] leading-relaxed text-zinc-500 space-y-0.5">
                            <div><span className="text-violet-400">import</span> {'{'} useState {'}'} <span className="text-violet-400">from</span> <span className="text-green-400">&apos;react&apos;</span>;</div>
                            <div><span className="text-violet-400">import</span> {'{'} motion {'}'} <span className="text-violet-400">from</span> <span className="text-green-400">&apos;framer-motion&apos;</span>;</div>
                            <div />
                            <div><span className="text-violet-400">export default</span> <span className="text-cyan-400">function</span> <span className="text-zinc-300">Dashboard</span>() {'{'}</div>
                            <div className="pl-4"><span className="text-violet-400">const</span> [data, setData] = <span className="text-cyan-400">useState</span>([]);</div>
                            <div className="pl-4"><span className="text-violet-400">const</span> [loading, setLoading] = <span className="text-cyan-400">useState</span>(<span className="text-cyan-400">true</span>);</div>
                            <div />
                            <div className="pl-4"><span className="text-cyan-400">useEffect</span>(() =&gt; {'{'}</div>
                            <div className="pl-8"><span className="text-cyan-400">fetch</span>(<span className="text-green-400">&apos;/api/analytics&apos;</span>)</div>
                            <div className="pl-12">.<span className="text-cyan-400">then</span>(r =&gt; r.<span className="text-cyan-400">json</span>())</div>
                            <div className="pl-12">.<span className="text-cyan-400">then</span>(setData)</div>
                            <div className="pl-12">.<span className="text-cyan-400">finally</span>(() =&gt; <span className="text-cyan-400">setLoading</span>(<span className="text-cyan-400">false</span>));</div>
                            <div className="pl-4">{'}'}, []);</div>
                          </div>
                        )}
                        {idx === 1 && (
                          <div className="flex flex-col h-full gap-3">
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span className="text-[10px] text-zinc-600">Live — localhost:3000</span>
                            </div>
                            <div className="flex-1 glass rounded-lg border border-[var(--border-subtle)] p-4 flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-zinc-300">Analytics Dashboard</span>
                                <span className="text-[10px] text-zinc-600">Updated just now</span>
                              </div>
                              <div className="flex gap-3">
                                {[{ l: 'Users', v: '2,847' }, { l: 'Revenue', v: '$12.4K' }, { l: 'Growth', v: '+24%' }].map((s) => (
                                  <div key={s.l} className="flex-1 rounded bg-black/20 p-2">
                                    <div className="text-[9px] text-zinc-600">{s.l}</div>
                                    <div className="text-xs font-semibold text-zinc-300">{s.v}</div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex-1 flex items-end gap-1 px-1">
                                {[35, 50, 40, 65, 55, 80, 70, 90, 75, 85, 95, 88].map((h, i) => (
                                  <div key={i} className="flex-1 bg-gradient-to-t from-violet-600/40 to-violet-600/10 rounded-t" style={{ height: `${h}%` }} />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        {idx === 2 && (
                          <div className="flex flex-col items-center justify-center h-full gap-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                              <RiCheckLine className="w-8 h-8 text-emerald-400" />
                            </div>
                            <div className="text-base font-medium text-zinc-300">Deployed to Production</div>
                            <div className="text-sm text-violet-400 font-mono">my-dashboard.vercel.app</div>
                            <div className="flex gap-2 mt-1">
                              {['Vercel', 'GitHub', 'Custom Domain'].map((p) => (
                                <span key={p} className="px-2.5 py-1 rounded-full text-[10px] bg-white/[0.03] text-zinc-500 border border-[var(--border-subtle)]">{p}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-[10px] text-zinc-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> SSL Active</span>
                              <span className="text-[10px] text-zinc-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> CDN Enabled</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── Features Grid ─────────── */}
      <section id="features" className="py-24 px-6 border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-[var(--text-secondary)] mb-4">
                <RiFlashlightLine className="w-3.5 h-3.5 text-violet-400" />
                Features
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4 text-center">
              Everything you need to{' '}
              <span className="gradient-text">ship fast</span>
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto text-center mb-16">
              A complete development environment powered by AI. From idea to production in minutes.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={i * 80}>
                  <div className="glass rounded-xl p-6 glow-hover cursor-default h-full">
                    <div className="w-10 h-10 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{feature.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────── Social Proof — Stats + Testimonials (Ribbit style) ─────────── */}
      <section className="py-24 px-6 border-t border-[var(--border-subtle)]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-[var(--text-secondary)] mb-4">
                <RiTeamLine className="w-3.5 h-3.5 text-violet-400" />
                Social Proof
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-center mb-4">
              Real developers, surreal results
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto text-center mb-16">
              Thousands of developers ship faster with DevForge. Here&apos;s what the numbers say.
            </p>
          </Reveal>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {STATS.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 100}>
                <div className="text-center glass rounded-xl p-6 border border-[var(--border-subtle)]">
                  <div className="text-3xl sm:text-4xl font-bold gradient-text mb-1">{stat.value}</div>
                  <div className="text-sm text-[var(--text-secondary)]">{stat.label}</div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Testimonial cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 120}>
                <div className="glass rounded-xl p-6 flex flex-col justify-between h-full border border-[var(--border-subtle)] glow-hover">
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{t.role}</div>
                    </div>
                    <span className="text-xs text-zinc-600 font-medium">{t.company}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── CTA Section ─────────── */}
      <section id="pricing" className="relative py-28 px-6 overflow-hidden border-t border-[var(--border-subtle)]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />

        <Reveal className="max-w-2xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-[var(--text-secondary)] mb-6">
            <Image src="/logo.png" alt="" width={14} height={14} className="w-3.5 h-3.5 rounded-sm" loading="lazy" />
            Get Started
          </div>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-5 leading-tight">
            Get started with<br />
            <span className="gradient-text">DevForge today</span>
          </h2>
          <p className="text-[var(--text-secondary)] mb-10 max-w-lg mx-auto">
            Join thousands of developers who are shipping apps faster with AI.
            Free to get started — no credit card required.
          </p>
          <div className="flex items-center justify-center gap-4 mb-10">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-8 py-3 rounded-lg transition-all hover:shadow-[0_0_24px_-4px_rgba(124,58,237,0.5)] cursor-pointer"
            >
              Try for Free
              <RiArrowRightLine className="w-4 h-4" />
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 text-sm font-medium px-8 py-3 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-zinc-600 transition-all cursor-pointer"
            >
              Request Demo
            </Link>
          </div>
          {/* Repeated trust logos */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            {TRUSTED_BY.slice(0, 6).map((tech) => (
              <span key={tech} className="text-xs font-medium text-zinc-600">{tech}</span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ─────────── Footer ─────────── */}
      <footer className="border-t border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
            {Object.entries(FOOTER_LINKS).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{category}</h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link}>
                      <span className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">{link}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)]">
          <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[var(--text-muted)]">&copy; {new Date().getFullYear()} DevForge Inc. All rights reserved.</p>
            <div className="flex items-center gap-4">
              {['Privacy', 'Terms', 'Cookies'].map((item) => (
                <span key={item} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer">{item}</span>
              ))}
            </div>
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
