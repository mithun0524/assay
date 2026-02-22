'use client';

import { useState } from 'react';
import { RiCloseLine, RiRocketLine, RiExternalLinkLine, RiErrorWarningLine, RiGithubLine } from '@remixicon/react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { DeployProvider, deployToVercel, deployToNetlify, deployToCloudflare } from '@/lib/deploy';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDERS = [
  {
    id: 'vercel' as DeployProvider,
    name: 'Vercel',
    description: 'Deploy with zero configuration',
    icon: '▲',
    color: 'from-black to-zinc-800',
    url: 'https://vercel.com/new',
  },
  {
    id: 'netlify' as DeployProvider,
    name: 'Netlify',
    description: 'Build, deploy, and scale web apps',
    icon: '◆',
    color: 'from-teal-500 to-emerald-600',
    url: 'https://app.netlify.com/start',
  },
  {
    id: 'cloudflare' as DeployProvider,
    name: 'Cloudflare Pages',
    description: 'JAMstack platform on Cloudflare',
    icon: '☁',
    color: 'from-orange-500 to-yellow-500',
    url: 'https://dash.cloudflare.com/',
  },
];

export function DeployModal({ isOpen, onClose }: DeployModalProps) {
  const { files, githubRepo, githubUser } = useStore();
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFiles = Object.keys(files).length > 0;

  const handleDeploy = async (provider: DeployProvider) => {
    if (!hasFiles) {
      setError('No files to deploy. Create a project first.');
      return;
    }

    if (!githubUser || !githubRepo) {
      setError(
        'Please push your project to GitHub first. Click "Connect GitHub" in the header, then push your changes.'
      );
      return;
    }

    setDeploying(true);
    setError(null);

    try {
      let result;
      switch (provider) {
        case 'vercel':
          result = await deployToVercel(files, githubRepo.name);
          break;
        case 'netlify':
          result = await deployToNetlify(files, githubRepo.name);
          break;
        case 'cloudflare':
          result = await deployToCloudflare(files, githubRepo.name);
          break;
      }

      // Success - close modal
      onClose();
    } catch (err) {
      console.error('Deploy error:', err);
      setError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setDeploying(false);
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
        className="relative w-full max-w-2xl rounded-2xl glass-strong border border-white/[0.06] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <RiRocketLine className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Deploy Your Project</h2>
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
          {/* GitHub status */}
          {!githubUser ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <RiGithubLine size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-400 mb-0.5">
                  GitHub Connection Required
                </p>
                <p className="text-xs text-amber-400/80">
                  Connect your GitHub account and push your project first. Click "Connect
                  GitHub" in the header to get started.
                </p>
              </div>
            </div>
          ) : !githubRepo ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <RiGithubLine size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-400 mb-0.5">
                  Push to GitHub First
                </p>
                <p className="text-xs text-amber-400/80">
                  Your project needs to be on GitHub before deploying. Click the "Push"
                  button in the header to push your changes.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <RiGithubLine size={16} className="text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-green-400">
                  Connected to{' '}
                  <span className="font-medium">
                    {githubRepo.owner}/{githubRepo.name}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Provider cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleDeploy(provider.id)}
                disabled={deploying || !hasFiles}
                className={cn(
                  'group relative p-4 rounded-xl text-left transition-all',
                  'border border-white/[0.06] hover:border-white/[0.15]',
                  'bg-gradient-to-br',
                  provider.color,
                  'hover:scale-[1.02] active:scale-[0.98]',
                  (deploying || !hasFiles) && 'opacity-50 cursor-not-allowed hover:scale-100'
                )}
              >
                <div className="relative z-10">
                  <div className="text-3xl mb-2">{provider.icon}</div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {provider.name}
                  </h3>
                  <p className="text-xs text-white/70 mb-3">{provider.description}</p>
                  <div className="flex items-center gap-1 text-xs text-white/90 font-medium">
                    Deploy Now
                    <RiExternalLinkLine size={12} />
                  </div>
                </div>

                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
              </button>
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <RiErrorWarningLine size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/[0.06]">
            <h4 className="text-xs font-medium text-zinc-300 mb-2">How it works:</h4>
            <ol className="space-y-1 text-xs text-zinc-400">
              <li>1. Make sure your project is pushed to GitHub</li>
              <li>2. Click a provider above to open their deployment page</li>
              <li>3. Import your GitHub repository</li>
              <li>
                4. The provider will auto-detect settings and deploy (usually takes 1-2 min)
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
          <p className="text-xs text-zinc-500">All platforms offer free tiers</p>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
