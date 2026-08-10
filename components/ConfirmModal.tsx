'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * The app's confirmation dialog.
 *
 * Exists because window.confirm() renders as browser chrome — the OS dialog,
 * the OS fonts, and a "assay-build.vercel.app says" header — which throws away
 * the theme at exactly the moment the user is being asked to destroy something.
 * It also blocks the main thread, so anything animating behind it freezes.
 *
 * Generalised out of ExitConfirmModal, which was this component with the
 * sign-out copy baked in.
 */

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  /** Defaults to 'Confirm'. */
  confirmLabel?: string;
  /** Shown on the confirm button while the action runs. */
  loadingLabel?: string;
  cancelLabel?: string;
  icon?: ReactNode;
  loading?: boolean;
  /** Destructive actions get a red confirm button. */
  tone?: 'danger' | 'neutral';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  loadingLabel,
  cancelLabel = 'Cancel',
  icon,
  loading,
  tone = 'danger',
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // window.confirm() gave Escape-to-dismiss and a focused default button for
  // free. Losing those on the way to a nicer-looking dialog would be a
  // downgrade, so they are wired back up here.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.addEventListener('keydown', onKey);
    confirmRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, loading, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center"
          onClick={() => !loading && onClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-sm mx-4 rounded-2xl bg-[#111113] border border-white/[0.06] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center pt-8 pb-2">
              {icon && (
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 border ${
                    tone === 'danger'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400'
                      : 'bg-white/[0.04] border-white/[0.08] text-zinc-300'
                  }`}
                >
                  {icon}
                </div>
              )}
              <h2 id="confirm-modal-title" className="text-sm font-semibold text-zinc-100">
                {title}
              </h2>
              <div className="text-xs text-zinc-500 mt-1.5 text-center px-6">{description}</div>
            </div>

            <div className="flex gap-2 p-5 pt-6">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] rounded-xl transition-all disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 px-4 py-2.5 text-xs font-medium text-white rounded-xl transition-all disabled:opacity-50 ${
                  tone === 'danger'
                    ? 'bg-red-600/90 hover:bg-red-500'
                    : 'bg-white/[0.12] hover:bg-white/[0.18]'
                }`}
              >
                {loading ? (loadingLabel ?? `${confirmLabel}…`) : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
