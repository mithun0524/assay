'use client';

import { useState } from 'react';
import { RiCloseLine, RiDownloadLine, RiErrorWarningLine } from '@remixicon/react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { cloneRepository, parseGitHubUrl } from '@/lib/github';
import { writeFileToSandbox } from '@/lib/fileSystem';

interface GitHubCloneDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GitHubCloneDialog({ isOpen, onClose }: GitHubCloneDialogProps) {
  const { setFile, setGitHubRepo, setHasProject, clearFiles, clearMessages, openTab } =
    useStore();
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClone = async () => {
    if (!repoUrl.trim()) {
      setError('Please enter a repository URL');
      return;
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      setError('Invalid GitHub URL. Format: https://github.com/owner/repo');
      return;
    }

    setCloning(true);
    setError(null);

    try {
      // Clone repository
      const files = await cloneRepository(parsed.owner, parsed.repo, branch);

      // Clear existing project
      clearFiles();
      clearMessages();

      // Add files to store
      for (const [path, entry] of Object.entries(files)) {
        setFile(path, entry);
        await writeFileToSandbox(path, entry.content);
      }

      // Save GitHub repo info
      setGitHubRepo({
        owner: parsed.owner,
        name: parsed.repo,
        url: `https://github.com/${parsed.owner}/${parsed.repo}`,
      });

      // Open main file
      const mainFile = files['src/App.tsx'] || files['src/App.jsx'] || files['src/main.tsx'];
      if (mainFile) {
        const mainPath = Object.keys(files).find((p) => p === 'src/App.tsx' || p === 'src/App.jsx' || p === 'src/main.tsx');
        if (mainPath) {
          openTab(mainPath);
        }
      }

      setHasProject(true);

      // Success!
      onClose();
      alert(`Successfully cloned ${parsed.owner}/${parsed.repo}!`);
    } catch (err) {
      console.error('Clone error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to clone repository. Make sure the repository exists and is accessible.'
      );
    } finally {
      setCloning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md rounded-2xl glass-strong border border-white/[0.06] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <RiDownloadLine className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Clone from GitHub</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
          >
            <RiCloseLine className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Repository URL */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Repository URL
            </label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://github.com/owner/repo"
              className={cn(
                'w-full px-3 py-2 rounded-lg text-sm text-zinc-200',
                'bg-zinc-800 border border-white/[0.06]',
                'focus:outline-none focus:border-violet-500/40',
                'placeholder:text-zinc-600'
              )}
            />
          </div>

          {/* Branch */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Branch (optional)
            </label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className={cn(
                'w-full px-3 py-2 rounded-lg text-sm text-zinc-200',
                'bg-zinc-800 border border-white/[0.06]',
                'focus:outline-none focus:border-violet-500/40',
                'placeholder:text-zinc-600'
              )}
            />
            <p className="mt-1.5 text-[11px] text-zinc-600">
              Leave as 'main' if unsure. Some repos use 'master'.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <RiErrorWarningLine size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <RiErrorWarningLine size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">
              This will replace your current project. Make sure you've saved any changes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            disabled={cloning}
            className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            disabled={cloning || !repoUrl.trim()}
            className={cn(
              'px-4 py-1.5 text-xs font-medium rounded-lg transition-all',
              cloning || !repoUrl.trim()
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'btn-premium'
            )}
          >
            {cloning ? 'Cloning...' : 'Clone Repository'}
          </button>
        </div>
      </div>
    </div>
  );
}
