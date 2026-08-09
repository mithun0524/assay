'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface InlineEditPopupProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  selectedText: string;
  onSubmit: (instruction: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function InlineEditPopup({
  isOpen,
  position,
  selectedText,
  onSubmit,
  onClose,
  isLoading = false,
}: InlineEditPopupProps) {
  const [instruction, setInstruction] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setInstruction('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (instruction.trim() && !isLoading) {
      onSubmit(instruction.trim());
      setInstruction('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && position && (
        <div key="inline-edit-backdrop" className="fixed inset-0 z-50" onClick={onClose}>
          <motion.div
            key="inline-edit-popup"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute"
            style={{
              left: Math.min(position.x, window.innerWidth - 400),
              top: position.y,
              maxWidth: '400px',
              minWidth: '320px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#18181b] border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border-b border-white/[0.08]">
                <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                <span className="text-xs font-medium text-zinc-200">AI Edit</span>
                {selectedText && (
                  <span className="ml-auto text-[10px] text-zinc-500">
                    {selectedText.split('\n').length} lines selected
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="p-0.5 hover:bg-white/[0.06] rounded transition-all ml-1"
                  disabled={isLoading}
                >
                  <X className="w-3 h-3 text-zinc-500" />
                </button>
              </div>

              {/* Input */}
              <div className="p-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what you want to change..."
                  disabled={isLoading}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-xs text-zinc-200',
                    'bg-white/[0.04] border border-white/[0.06]',
                    'focus:outline-none focus:border-white/45 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]',
                    'placeholder:text-zinc-600',
                    'transition-all',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                />

                {/* Action buttons */}
                <div className="flex items-center justify-between mt-2">
                  <div className="text-[10px] text-zinc-600">
                    Press <kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-zinc-400">Enter</kbd> to submit, <kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-zinc-400">Esc</kbd> to cancel
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!instruction.trim() || isLoading}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                      'bg-zinc-50 text-zinc-950 hover:bg-white',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center gap-1.5'
                    )}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Editing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Edit
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
