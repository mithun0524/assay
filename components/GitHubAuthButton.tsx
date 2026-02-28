'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiGithubLine, RiLogoutBoxRLine, RiLinkM } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useAuthContext } from './Providers';
import { AuthModal } from './AuthModal';
import { ExitConfirmModal } from './ExitConfirmModal';

export function GitHubAuthButton() {
  const { user, loading, isGitHubLinked, signOut, linkGitHub } = useAuthContext();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [linking, setLinking] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/');
    } finally {
      setSigningOut(false);
      setShowExitModal(false);
    }
  };

  const handleLinkGitHub = async () => {
    setLinking(true);
    try {
      await linkGitHub();
    } catch (err) {
      console.error('Link GitHub error:', err);
      alert('Failed to link GitHub. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-zinc-800/50 animate-pulse">
        <div className="w-16 h-4" />
      </div>
    );
  }

  // Signed in with GitHub linked
  if (user && isGitHubLinked) {
    const avatarUrl = user.user_metadata?.avatar_url;
    const name = user.user_metadata?.user_name || user.user_metadata?.full_name || user.email;

    return (
      <>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50">
            {avatarUrl && (
              <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full" />
            )}
            <span className="text-xs text-zinc-300">{name}</span>
          </div>
          <button
            onClick={() => setShowExitModal(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Sign out"
          >
            <RiLogoutBoxRLine size={16} />
          </button>
        </div>
        <ExitConfirmModal isOpen={showExitModal} onClose={() => setShowExitModal(false)} onConfirm={handleSignOut} loading={signingOut} />
      </>
    );
  }

  // Signed in but GitHub NOT linked (Google/Email user)
  if (user && !isGitHubLinked) {
    const avatarUrl = user.user_metadata?.avatar_url;
    const name = user.user_metadata?.full_name || user.email;

    return (
      <>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50">
            {avatarUrl && (
              <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full" />
            )}
            <span className="text-xs text-zinc-300">{name}</span>
          </div>
          <button
            onClick={handleLinkGitHub}
            disabled={linking}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
              linking
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
            )}
          >
            <RiLinkM size={14} />
            {linking ? 'Linking...' : 'Link GitHub'}
          </button>
          <button
            onClick={() => setShowExitModal(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            title="Sign out"
          >
            <RiLogoutBoxRLine size={16} />
          </button>
        </div>
        <ExitConfirmModal isOpen={showExitModal} onClose={() => setShowExitModal(false)} onConfirm={handleSignOut} loading={signingOut} />
      </>
    );
  }

  // Not signed in
  return (
    <>
      <button
        onClick={() => setShowAuthModal(true)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
          'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
        )}
      >
        <RiGithubLine size={16} />
        Sign In
      </button>
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
