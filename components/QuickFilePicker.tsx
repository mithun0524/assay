'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileCode, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface QuickFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
}

function fuzzyMatch(query: string, target: string): { matches: boolean; score: number } {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  if (q.length === 0) return { matches: true, score: 0 };
  if (t.includes(q)) return { matches: true, score: 100 - t.indexOf(q) };

  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      score += consecutive * 2;
      // Bonus for matching after separator
      if (ti === 0 || t[ti - 1] === '/' || t[ti - 1] === '.' || t[ti - 1] === '-') {
        score += 5;
      }
    } else {
      consecutive = 0;
    }
  }

  return { matches: qi === q.length, score };
}

export function QuickFilePicker({ isOpen, onClose }: QuickFilePickerProps) {
  const { files, openTab } = useStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filePaths = useMemo(() => Object.keys(files), [files]);

  const results = useMemo(() => {
    if (!query.trim()) {
      return filePaths.slice(0, 20);
    }

    return filePaths
      .map((path) => {
        const { matches, score } = fuzzyMatch(query, path);
        return { path, matches, score };
      })
      .filter((r) => r.matches)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.path);
  }, [filePaths, query]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[selectedIndex]) {
      (items[selectedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback((path: string) => {
    openTab(path);
    onClose();
  }, [openTab, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, selectedIndex, handleSelect, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
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
            className="relative w-full max-w-lg mx-4 rounded-xl bg-[#111113] border border-white/[0.06] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-2 px-3 border-b border-white/[0.06]">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search files by name..."
                className="flex-1 py-3 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] text-zinc-600 bg-white/[0.04] border border-white/[0.06] rounded">
                esc
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
              {results.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-zinc-600">
                  No files found
                </div>
              ) : (
                results.map((path, i) => {
                  const parts = path.split('/');
                  const filename = parts.pop() || path;
                  const dir = parts.join('/');

                  return (
                    <button
                      key={path}
                      onClick={() => handleSelect(path)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                        i === selectedIndex
                          ? 'bg-violet-500/15 text-zinc-100'
                          : 'text-zinc-400 hover:bg-white/[0.04]'
                      )}
                    >
                      <FileCode className={cn(
                        'w-4 h-4 shrink-0',
                        i === selectedIndex ? 'text-violet-400' : 'text-zinc-600'
                      )} />
                      <span className="text-sm truncate">
                        <span className="text-zinc-200">{filename}</span>
                        {dir && (
                          <span className="text-zinc-600 ml-2 text-xs">{dir}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-white/[0.06] flex items-center gap-3 text-[10px] text-zinc-600">
              <span><kbd className="px-1 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[10px]">&uarr;&darr;</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[10px]">&crarr;</kbd> open</span>
              <span><kbd className="px-1 py-0.5 bg-white/[0.04] border border-white/[0.06] rounded text-[10px]">esc</kbd> close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
