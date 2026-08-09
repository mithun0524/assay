'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, FileCode, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface FindInFilesProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

function searchFiles(
  files: Record<string, { content: string; language: string }>,
  query: string
): SearchResult[] {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  for (const [filePath, entry] of Object.entries(files)) {
    const lines = entry.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      const idx = lowerLine.indexOf(lowerQuery);

      if (idx !== -1) {
        results.push({
          filePath,
          lineNumber: i + 1,
          lineContent: line,
          matchStart: idx,
          matchEnd: idx + query.length,
        });

        if (results.length >= 200) return results;
      }
    }
  }

  return results;
}

function groupByFile(results: SearchResult[]): Map<string, SearchResult[]> {
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = map.get(r.filePath) || [];
    list.push(r);
    map.set(r.filePath, list);
  }
  return map;
}

export function FindInFiles({ isOpen, onClose }: FindInFilesProps) {
  const { files, openTab } = useStore();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const results = useMemo(() => searchFiles(files, debouncedQuery), [files, debouncedQuery]);
  const grouped = useMemo(() => groupByFile(results), [results]);

  const handleResultClick = useCallback((filePath: string) => {
    openTab(filePath);
    onClose();
  }, [openTab, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
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
            className="relative w-full max-w-2xl mx-4 rounded-xl bg-[#111113] border border-white/[0.06] shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '70vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-2 px-3 border-b border-white/[0.06] shrink-0">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in all files..."
                className="flex-1 py-3 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-1 hover:bg-white/[0.06] rounded transition-all"
                >
                  <X className="w-3.5 h-3.5 text-zinc-500" />
                </button>
              )}
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] text-zinc-600 bg-white/[0.04] border border-white/[0.06] rounded">
                esc
              </kbd>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {!debouncedQuery.trim() ? (
                <div className="px-4 py-12 text-center text-xs text-zinc-600">
                  Type to search across all files
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-12 text-center text-xs text-zinc-600">
                  No results found for &ldquo;{debouncedQuery}&rdquo;
                </div>
              ) : (
                <div className="py-1">
                  {Array.from(grouped.entries()).map(([filePath, matches]) => (
                    <div key={filePath} className="mb-1">
                      {/* File header */}
                      <button
                        onClick={() => handleResultClick(filePath)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.04] transition-colors"
                      >
                        <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="text-xs font-medium text-zinc-300 truncate">{filePath}</span>
                        <span className="text-[10px] text-zinc-600 ml-auto shrink-0">
                          {matches.length} match{matches.length > 1 ? 'es' : ''}
                        </span>
                      </button>

                      {/* Match lines */}
                      {matches.slice(0, 10).map((match, i) => (
                        <button
                          key={`${filePath}-${match.lineNumber}-${i}`}
                          onClick={() => handleResultClick(filePath)}
                          className="w-full flex items-start gap-2 pl-8 pr-3 py-1 text-left hover:bg-white/[0.06] transition-colors group"
                        >
                          <span className="text-[10px] text-zinc-600 font-mono w-8 text-right shrink-0 pt-0.5">
                            {match.lineNumber}
                          </span>
                          <span className="text-xs text-zinc-500 font-mono truncate">
                            {match.lineContent.substring(0, match.matchStart)}
                            <span className="text-amber-300 bg-amber-500/15 rounded-sm px-0.5">
                              {match.lineContent.substring(match.matchStart, match.matchEnd)}
                            </span>
                            {match.lineContent.substring(match.matchEnd)}
                          </span>
                        </button>
                      ))}
                      {matches.length > 10 && (
                        <div className="pl-8 pr-3 py-1 text-[10px] text-zinc-600">
                          ... and {matches.length - 10} more matches
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-white/[0.06] flex items-center gap-3 text-[10px] text-zinc-600 shrink-0">
              <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
              {results.length >= 200 && (
                <span className="text-amber-500/70">showing first 200</span>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
