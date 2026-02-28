'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { RiLogoutBoxRLine } from '@remixicon/react';

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function ExitConfirmModal({ isOpen, onClose, onConfirm, loading }: ExitConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center"
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
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-sm mx-4 rounded-2xl bg-[#111113] border border-white/[0.06] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex flex-col items-center pt-8 pb-2">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <RiLogoutBoxRLine className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-sm font-semibold text-zinc-100">Sign out?</h2>
              <p className="text-xs text-zinc-500 mt-1.5 text-center px-6">
                You'll need to sign back in to access your projects and settings.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 p-5 pt-6">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-xs font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-xs font-medium text-white bg-red-600/90 hover:bg-red-500 rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
