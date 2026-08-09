'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Mail } from 'lucide-react';
import { RiGithubLine, RiGoogleLine } from '@remixicon/react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthContext } from './Providers';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithGitHub, signInWithGoogle, signInWithEmail, signUpWithEmail } =
    useAuthContext();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefetch /app so navigation after login is instant
  useEffect(() => {
    router.prefetch('/app');
  }, [router]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setEmail('');
      setPassword('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        onClose();
        router.push('/app');
      } else {
        await signUpWithEmail(email, password);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-sm mx-4 rounded-2xl bg-[#111113] border border-white/[0.06] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-zinc-100">
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-3">
              {/* OAuth buttons */}
              <button
                onClick={() => signInWithGitHub()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-50 text-zinc-950 hover:bg-white transition-all"
              >
                <RiGithubLine size={18} />
                Continue with GitHub
              </button>

              <button
                onClick={() => signInWithGoogle()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] text-zinc-200 hover:bg-white/[0.10] border border-white/[0.06] transition-all"
              >
                <RiGoogleLine size={18} />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[11px] text-zinc-600 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Email form */}
              <div className="space-y-2.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl text-sm text-zinc-200',
                    'bg-white/[0.04] border border-white/[0.06]',
                    'focus:outline-none focus:border-white/45',
                    'placeholder:text-zinc-600 transition-all'
                  )}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                  placeholder="Password"
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl text-sm text-zinc-200',
                    'bg-white/[0.04] border border-white/[0.06]',
                    'focus:outline-none focus:border-white/45',
                    'placeholder:text-zinc-600 transition-all'
                  )}
                />
                <button
                  onClick={handleEmailAuth}
                  disabled={loading}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                    loading
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                      : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.10] border border-white/[0.06]'
                  )}
                >
                  <Mail size={16} />
                  {loading
                    ? 'Please wait...'
                    : mode === 'signin'
                      ? 'Sign In with Email'
                      : 'Sign Up with Email'}
                </button>
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-400 text-center">{error}</p>
              )}

              {/* Toggle mode */}
              <p className="text-center text-xs text-zinc-600 pt-1">
                {mode === 'signin' ? (
                  <>
                    Don&apos;t have an account?{' '}
                    <button
                      onClick={() => { setMode('signup'); setError(null); }}
                      className="text-zinc-300 hover:text-zinc-50 transition-colors"
                    >
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      onClick={() => { setMode('signin'); setError(null); }}
                      className="text-zinc-300 hover:text-zinc-50 transition-colors"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
