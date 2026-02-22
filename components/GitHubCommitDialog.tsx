'use client';

import { useState, useEffect } from 'react';
import { RiCloseLine, RiUploadLine, RiErrorWarningLine } from '@remixicon/react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { pushToRepository, createRepository, listRepositories } from '@/lib/github';

interface GitHubCommitDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GitHubCommitDialog({ isOpen, onClose }: GitHubCommitDialogProps) {
  const { files, githubRepo, setGitHubRepo } = useStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<Array<{ name: string; full_name: string }>>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [createNew, setCreateNew] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Load repositories when dialog opens
  useEffect(() => {
    if (isOpen && !githubRepo) {
      loadRepositories();
    }
  }, [isOpen, githubRepo]);

  const loadRepositories = async () => {
    setLoadingRepos(true);
    setError(null);
    try {
      const repoList = await listRepositories({ per_page: 50 });
      setRepos(repoList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const handlePush = async () => {
    if (!commitMessage.trim()) {
      setError('Please enter a commit message');
      return;
    }

    setPushing(true);
    setError(null);

    try {
      let owner: string;
      let repoName: string;
      let repoUrl: string;

      if (createNew) {
        if (!newRepoName.trim()) {
          setError('Please enter a repository name');
          setPushing(false);
          return;
        }

        // Create new repository
        const newRepo = await createRepository(
          newRepoName,
          newRepoDescription,
          isPrivate
        );
        owner = newRepo.full_name.split('/')[0];
        repoName = newRepo.name;
        repoUrl = newRepo.html_url;

        // Save to store
        setGitHubRepo({ owner, name: repoName, url: repoUrl });
      } else if (githubRepo) {
        owner = githubRepo.owner;
        repoName = githubRepo.name;
        repoUrl = githubRepo.url;
      } else if (selectedRepo) {
        const [repoOwner, repoNameOnly] = selectedRepo.split('/');
        owner = repoOwner;
        repoName = repoNameOnly;
        repoUrl = `https://github.com/${selectedRepo}`;

        // Save to store
        setGitHubRepo({ owner, name: repoName, url: repoUrl });
      } else {
        setError('Please select or create a repository');
        setPushing(false);
        return;
      }

      // Push files
      await pushToRepository(owner, repoName, files, commitMessage);

      // Success!
      onClose();
      alert(`Successfully pushed to ${owner}/${repoName}!`);
    } catch (err) {
      console.error('Push error:', err);
      setError(err instanceof Error ? err.message : 'Failed to push to GitHub');
    } finally {
      setPushing(false);
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
        className="relative w-full max-w-md rounded-2xl glass-strong border border-white/[0.08] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <RiUploadLine className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Push to GitHub</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
          >
            <RiCloseLine className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Repository selection */}
          {!githubRepo && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">
                Repository
              </label>

              {/* Toggle: existing or new */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setCreateNew(false)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                    !createNew
                      ? 'bg-violet-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  )}
                >
                  Existing
                </button>
                <button
                  onClick={() => setCreateNew(true)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                    createNew
                      ? 'bg-violet-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  )}
                >
                  Create New
                </button>
              </div>

              {/* Existing repo dropdown */}
              {!createNew && (
                <select
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  disabled={loadingRepos}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm text-zinc-200',
                    'bg-zinc-800 border border-white/[0.08]',
                    'focus:outline-none focus:border-violet-500/40',
                    loadingRepos && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <option value="">
                    {loadingRepos ? 'Loading...' : 'Select a repository'}
                  </option>
                  {repos.map((repo) => (
                    <option key={repo.full_name} value={repo.full_name}>
                      {repo.full_name}
                    </option>
                  ))}
                </select>
              )}

              {/* New repo form */}
              {createNew && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Repository name"
                    value={newRepoName}
                    onChange={(e) => setNewRepoName(e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm text-zinc-200',
                      'bg-zinc-800 border border-white/[0.08]',
                      'focus:outline-none focus:border-violet-500/40',
                      'placeholder:text-zinc-600'
                    )}
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={newRepoDescription}
                    onChange={(e) => setNewRepoDescription(e.target.value)}
                    rows={2}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg text-sm text-zinc-200 resize-none',
                      'bg-zinc-800 border border-white/[0.08]',
                      'focus:outline-none focus:border-violet-500/40',
                      'placeholder:text-zinc-600'
                    )}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-800 text-violet-500 focus:ring-violet-500"
                    />
                    <span className="text-xs text-zinc-400">Private repository</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Current repo info */}
          {githubRepo && (
            <div className="px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/[0.06]">
              <div className="text-xs text-zinc-400 mb-0.5">Pushing to:</div>
              <div className="text-sm font-medium text-zinc-200">
                {githubRepo.owner}/{githubRepo.name}
              </div>
            </div>
          )}

          {/* Commit message */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">
              Commit Message
            </label>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Update project files"
              rows={3}
              className={cn(
                'w-full px-3 py-2 rounded-lg text-sm text-zinc-200 resize-none',
                'bg-zinc-800 border border-white/[0.08]',
                'focus:outline-none focus:border-violet-500/40',
                'placeholder:text-zinc-600'
              )}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <RiErrorWarningLine size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* File count */}
          <div className="text-xs text-zinc-500">
            {Object.keys(files).length} file{Object.keys(files).length !== 1 ? 's' : ''}{' '}
            will be pushed
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            disabled={pushing}
            className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePush}
            disabled={pushing || !commitMessage.trim()}
            className={cn(
              'px-4 py-1.5 text-xs font-medium rounded-lg transition-all',
              pushing || !commitMessage.trim()
                ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                : 'btn-premium'
            )}
          >
            {pushing ? 'Pushing...' : 'Push to GitHub'}
          </button>
        </div>
      </div>
    </div>
  );
}
