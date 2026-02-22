'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiGithubLine,
  RiGoogleLine,
  RiLoader4Line,
  RiCodeSSlashLine,
  RiTerminalBoxLine,
  RiLayoutGridLine,
} from '@remixicon/react';
import Image from 'next/image';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/Providers';

export function LoginForm() {
  const router = useRouter();
  const { user, loading, signInWithGitHub, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useAuthContext();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (user) router.replace('/app');
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <RiLoader4Line className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (user) return null;

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
        setEmailSent(true);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex overflow-hidden">
      {/* ── Left Panel: Form ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between px-8 sm:px-12 py-10 relative z-10">
        {/* Logo */}
        <div className="flex items-center animate-fade-in">
          <Image src="/logo-with-typo.png" alt="DevForge" width={140} height={36} className="h-9 w-auto" />
        </div>

        {/* Form Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[360px]">
            {emailSent ? (
              <div className="space-y-5 animate-fade-up">
                <div className="w-11 h-11 rounded-full bg-violet-500/15 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
                    Check your email
                  </h1>
                  <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                    We sent a confirmation link to{' '}
                    <span className="text-zinc-300">{email}</span>.
                    Click the link to complete your sign up.
                  </p>
                </div>
                <button
                  onClick={() => { setEmailSent(false); setMode('signin'); }}
                  className="text-sm text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Heading */}
                <div className="space-y-2 animate-fade-up">
                  <h1 className="text-[28px] font-semibold text-zinc-100 tracking-tight leading-tight">
                    {mode === 'signin' ? 'Welcome back' : 'Create your account'}
                  </h1>
                  <p className="text-sm text-zinc-500">
                    {mode === 'signin'
                      ? <>Don&apos;t have an account?{' '}
                          <button
                            onClick={() => { setMode('signup'); setError(null); }}
                            className="text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
                          >
                            Sign up for free
                          </button>
                        </>
                      : <>Already have an account?{' '}
                          <button
                            onClick={() => { setMode('signin'); setError(null); }}
                            className="text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
                          >
                            Log in
                          </button>
                        </>
                    }
                  </p>
                </div>

                {/* OAuth Buttons */}
                <div className="space-y-2.5 animate-fade-up delay-75">
                  <button
                    onClick={() => signInWithGoogle()}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] transition-all cursor-pointer"
                  >
                    <RiGoogleLine size={17} className="text-zinc-400" />
                    Log in with Google
                  </button>

                  <button
                    onClick={() => signInWithGitHub()}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.12] transition-all cursor-pointer"
                  >
                    <RiGithubLine size={17} className="text-zinc-400" />
                    Log in with GitHub
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 animate-fade-up delay-100">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[11px] text-zinc-600 uppercase tracking-widest">
                    Or log in with email
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {/* Email Form */}
                <div className="space-y-3 animate-fade-up delay-150">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={cn(
                        'w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-200',
                        'bg-white/[0.03] border border-white/[0.08]',
                        'focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/10',
                        'placeholder:text-zinc-600 transition-all'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                      placeholder="Enter your password"
                      className={cn(
                        'w-full px-3.5 py-2.5 rounded-xl text-sm text-zinc-200',
                        'bg-white/[0.03] border border-white/[0.08]',
                        'focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/10',
                        'placeholder:text-zinc-600 transition-all'
                      )}
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-400">{error}</p>
                  )}

                  <button
                    onClick={handleEmailAuth}
                    disabled={submitting}
                    className={cn(
                      'w-full py-2.5 rounded-xl text-sm font-medium transition-all mt-1',
                      submitting
                        ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                        : 'bg-zinc-100 text-zinc-900 hover:bg-white active:scale-[0.98] cursor-pointer'
                    )}
                  >
                    {submitting ? 'Please wait...' : mode === 'signin' ? 'Log in' : 'Create account'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-zinc-700 animate-fade-in delay-300">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>

      {/* ── Right Panel: Visual Hero ── */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center">
        {/* Gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/80 via-[#09090b] to-cyan-950/50" />
          <div className="absolute inset-0 opacity-60">
            <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-[120px]" />
            <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-cyan-500/15 blur-[100px]" />
            <div className="absolute top-[50%] left-[50%] w-[300px] h-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[80px]" />
          </div>
          {/* Noise overlay */}
          <div
            className="absolute inset-0 opacity-[0.35] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-md px-12 space-y-10">
          {/* Tagline */}
          <div className="space-y-4 animate-fade-up delay-200">
            <h2 className="text-3xl font-semibold text-zinc-100 tracking-tight leading-snug">
              Build full-stack apps<br />
              <span className="gradient-text">with natural language</span>
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
              Describe what you want. DevForge writes, previews, and deploys your code — all in one place.
            </p>
          </div>

          {/* Floating mock UI card */}
          <div className="relative animate-fade-up delay-400">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 space-y-4 shadow-2xl shadow-violet-500/5">
              {/* Mock header bar */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-3 py-0.5 rounded-md bg-white/[0.04] text-[10px] text-zinc-600 font-mono">
                    my-app.vercel.app
                  </div>
                </div>
              </div>

              {/* Mock code lines */}
              <div className="space-y-2 font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <RiCodeSSlashLine className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <span className="text-zinc-500">app/page.tsx</span>
                </div>
                <div className="pl-5 space-y-1">
                  <div className="text-cyan-400/70">export default <span className="text-violet-400/80">function</span> <span className="text-zinc-300">Home</span>() {'{'}</div>
                  <div className="text-zinc-600 pl-3">return {'<'}Dashboard /{'>'}</div>
                  <div className="text-cyan-400/70">{'}'}</div>
                </div>
              </div>

              {/* Mock feature pills */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/15">
                  <RiTerminalBoxLine className="w-3 h-3 text-violet-400" />
                  <span className="text-[10px] text-violet-300 font-medium">AI Chat</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/15">
                  <RiLayoutGridLine className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] text-cyan-300 font-medium">Live Preview</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
                  <span className="text-[10px]">&#9650;</span>
                  <span className="text-[10px] text-emerald-300 font-medium">Deploy</span>
                </div>
              </div>
            </div>

            {/* Subtle glow behind card */}
            <div className="absolute -inset-6 -z-10 rounded-3xl bg-violet-500/5 blur-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
