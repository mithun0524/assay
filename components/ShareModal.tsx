'use client';

import { useState, useRef, useEffect } from 'react';
import { RiCloseLine, RiShareLine, RiFileCopyLine, RiCheckLine, RiLoader4Line } from '@remixicon/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const { files } = useStore();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [projectName, setProjectName] = useState('My Project');
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleShare = async () => {
    if (Object.keys(files).length === 0) {
      toast.error('No files to share');
      return;
    }

    setIsSharing(true);
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim() || 'Untitled Project',
          files,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to share');
      }

      const data = await res.json();
      setShareUrl(data.url);
      toast.success('Project shared!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to share project');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setIsSharing(false);
    setCopied(false);
    setProjectName('My Project');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
          >
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-xl shadow-2xl p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/[0.04]">
                    <RiShareLine className="w-4 h-4 text-zinc-300" />
                  </div>
                  <h2 className="text-sm font-semibold text-zinc-100">Share Project</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <RiCloseLine className="w-4 h-4" />
                </button>
              </div>

              {!shareUrl ? (
                <>
                  {/* Project Name Input */}
                  <div className="mb-4">
                    <label className="text-xs text-zinc-500 mb-1.5 block">Project name</label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="My Project"
                      className="w-full px-3 py-2 text-sm text-zinc-200 bg-white/[0.04] border border-white/[0.08] rounded-xl placeholder:text-zinc-600 focus:outline-none focus:border-white/45"
                    />
                  </div>

                  {/* Info */}
                  <div className="mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Creates a read-only snapshot of your project that anyone with the link can view and fork.
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-1.5">
                      {Object.keys(files).length} file{Object.keys(files).length !== 1 ? 's' : ''} will be shared
                    </p>
                  </div>

                  {/* Share Button */}
                  <button
                    onClick={handleShare}
                    disabled={isSharing}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all',
                      isSharing
                        ? 'bg-zinc-50/50 text-zinc-900 cursor-not-allowed'
                        : 'bg-zinc-50 text-zinc-950 hover:bg-white'
                    )}
                  >
                    {isSharing ? (
                      <>
                        <RiLoader4Line className="w-4 h-4 animate-spin" />
                        Sharing...
                      </>
                    ) : (
                      <>
                        <RiShareLine className="w-4 h-4" />
                        Create Share Link
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {/* Success state */}
                  <div className="mb-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-xs text-emerald-400 mb-2">Project shared successfully!</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={shareUrl}
                        className="flex-1 px-3 py-1.5 text-xs text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded-lg font-mono"
                      />
                      <button
                        onClick={handleCopy}
                        className={cn(
                          'p-2 rounded-lg transition-all shrink-0',
                          copied
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-white/[0.06] text-zinc-400 hover:text-zinc-200'
                        )}
                      >
                        {copied ? (
                          <RiCheckLine className="w-3.5 h-3.5" />
                        ) : (
                          <RiFileCopyLine className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-zinc-50 text-zinc-950 hover:bg-white rounded-xl transition-all"
                    >
                      <RiFileCopyLine className="w-4 h-4" />
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                    <button
                      onClick={handleClose}
                      className="px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] rounded-xl transition-all"
                    >
                      Done
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
