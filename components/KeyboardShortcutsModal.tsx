'use client';

import { useEffect, useMemo } from 'react';
import { X, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return true;
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }, []);

  const mod = isMac ? '\u2318' : 'Ctrl';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const groups = [
    {
      title: 'General',
      shortcuts: [
        { keys: [mod, '/'], label: 'Keyboard shortcuts' },
        { keys: [mod, ','], label: 'Settings' },
      ],
    },
    {
      title: 'Editor',
      shortcuts: [
        { keys: [mod, 'S'], label: 'Save file' },
        { keys: [mod, 'Z'], label: 'Undo' },
        { keys: [mod, '\u21E7', 'Z'], label: 'Redo' },
      ],
    },
    {
      title: 'Search',
      shortcuts: [
        { keys: [mod, 'P'], label: 'Quick file picker' },
        { keys: [mod, '\u21E7', 'F'], label: 'Find in files' },
      ],
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
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
            className="relative w-full max-w-md mx-4 rounded-2xl bg-[#111113] border border-white/[0.06] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-5">
              {(() => {
                let globalIdx = 0;
                return groups.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-2.5">
                      {group.title}
                    </h3>
                    <div className="space-y-2">
                      {group.shortcuts.map((shortcut) => {
                        const idx = globalIdx++;
                        return (
                          <div
                            key={shortcut.label}
                            className="stagger-item flex items-center justify-between"
                            style={{ animationDelay: `${idx * 50 + 100}ms` }}
                          >
                            <span className="text-sm text-zinc-300">{shortcut.label}</span>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, i) => (
                                <kbd
                                  key={i}
                                  className="px-1.5 py-0.5 text-[11px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded min-w-[24px] text-center"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/[0.06]">
              <p className="text-[11px] text-zinc-600 text-center">
                Press <kbd className="px-1 py-0.5 text-[10px] font-mono text-zinc-500 bg-white/[0.04] border border-white/[0.06] rounded">Esc</kbd> to close
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
