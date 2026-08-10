'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiGithubLine,
  RiLogoutBoxRLine,
  RiLinkM,
  RiSettings3Line,
  RiKeyboardLine,
  RiCheckLine,
  RiArrowDownSLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuthContext } from './Providers';
import { AuthModal } from './AuthModal';
import { ExitConfirmModal } from './ExitConfirmModal';

/**
 * The account control.
 *
 * This was three separate things sitting in the header bar: a name plate, a
 * "Link GitHub" button, and a bare sign-out icon — three permanent controls for
 * actions taken once or never. Everything that belongs to *you* rather than to
 * the project now lives behind the name, which is where every tool in this
 * category puts it.
 */

/**
 * The user's picture, with a fallback that actually appears.
 *
 * Two things were wrong with a bare <img src={avatar_url}>. Google serves
 * avatars from lh3.googleusercontent.com and returns 403 when a referrer is
 * sent, which is every cross-origin request a browser makes by default — so a
 * Google-authenticated user got the broken-image glyph next to their name.
 * And once it failed there was nothing behind it, because the only guard was
 * on the URL being present, not on it loading.
 */
function Avatar({ src, name, size = 20 }: { src?: string; name?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();

  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full bg-white/[0.08] text-[10px] font-medium text-zinc-300 grid place-items-center"
      >
        {initial}
      </span>
    );
  }

  return (
    // Remote avatar hosts are user-controlled; next/image would need every one
    // allow-listed in next.config, and a 20px avatar is not worth that.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
    />
  );
}

function MenuItem({
  icon,
  label,
  hint,
  onClick,
  disabled,
  tone = 'normal',
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: 'normal' | 'danger';
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left',
        disabled
          ? 'text-zinc-500 cursor-default'
          : tone === 'danger'
            ? 'text-rose-300 hover:bg-rose-500/10'
            : 'text-zinc-300 hover:bg-white/[0.06]'
      )}
    >
      <span className="shrink-0 w-3.5 grid place-items-center">{icon}</span>
      <span className="truncate">{label}</span>
      {hint && <span className="ml-auto font-mono text-[10px] text-zinc-500 shrink-0">{hint}</span>}
    </button>
  );
}

interface Props {
  /** Opens the settings modal on its API-keys tab. */
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
}

export function GitHubAuthButton({ onOpenSettings, onOpenShortcuts }: Props) {
  const { user, loading, isGitHubLinked, signOut, linkGitHub } = useAuthContext();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [linking, setLinking] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // A menu that only closes on click-outside strands keyboard users inside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

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
    setOpen(false);
    try {
      await linkGitHub();
    } catch (err) {
      console.error('Link GitHub error:', err);
      toast.error('Failed to link GitHub. Please try again.');
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

  // Not signed in — nothing to put in a menu yet.
  if (!user) {
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

  const avatarUrl = user.user_metadata?.avatar_url;
  const name =
    user.user_metadata?.user_name || user.user_metadata?.full_name || user.email || 'Account';
  const email = user.email;
  const mod = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl+';

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(
            'flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg transition-colors max-w-[190px]',
            open ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]'
          )}
        >
          <Avatar src={avatarUrl} name={name} />
          <span className="text-xs text-zinc-300 truncate">{name}</span>
          <RiArrowDownSLine
            className={cn('w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>

        {open && (
          <>
            {/* Same overlay-plus-panel shape the export menu uses, rather than a
                second dropdown mechanism doing the same job differently. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 w-60 py-1.5 rounded-xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-lg shadow-xl z-50 animate-fade-up"
              style={{ animationDuration: '0.15s' }}
            >
              {/* Who you are, so the menu answers that before it offers to
                  change it. The email is the part that actually identifies the
                  account when two logins share a display name. */}
              <div className="flex items-center gap-2.5 px-3 pt-1 pb-2.5">
                <Avatar src={avatarUrl} name={name} size={32} />
                <div className="min-w-0">
                  <p className="text-xs text-zinc-200 truncate">{name}</p>
                  {email && <p className="text-[11px] text-zinc-500 truncate">{email}</p>}
                </div>
              </div>

              <div className="h-px bg-white/[0.06] mx-1 mb-1" />

              {isGitHubLinked ? (
                <MenuItem
                  icon={<RiCheckLine className="w-3.5 h-3.5 text-emerald-400" />}
                  label="GitHub connected"
                  disabled
                />
              ) : (
                <MenuItem
                  icon={<RiLinkM className="w-3.5 h-3.5 text-zinc-400" />}
                  label={linking ? 'Linking…' : 'Link GitHub'}
                  onClick={handleLinkGitHub}
                  disabled={linking}
                />
              )}

              {onOpenSettings && (
                <MenuItem
                  icon={<RiSettings3Line className="w-3.5 h-3.5 text-zinc-400" />}
                  label="Settings"
                  hint={`${mod},`}
                  onClick={() => { setOpen(false); onOpenSettings(); }}
                />
              )}

              {onOpenShortcuts && (
                <MenuItem
                  icon={<RiKeyboardLine className="w-3.5 h-3.5 text-zinc-400" />}
                  label="Keyboard shortcuts"
                  hint="?"
                  onClick={() => { setOpen(false); onOpenShortcuts(); }}
                />
              )}

              <div className="h-px bg-white/[0.06] mx-1 my-1" />

              <MenuItem
                icon={<RiLogoutBoxRLine className="w-3.5 h-3.5" />}
                label="Sign out"
                tone="danger"
                onClick={() => { setOpen(false); setShowExitModal(true); }}
              />
            </div>
          </>
        )}
      </div>

      <ExitConfirmModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={handleSignOut}
        loading={signingOut}
      />
    </>
  );
}
