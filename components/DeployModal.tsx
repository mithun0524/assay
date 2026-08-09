'use client';

import { useState, useEffect, useRef } from 'react';
import {
  RiCloseLine,
  RiRocketLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiKeyLine,
  RiRefreshLine,
} from '@remixicon/react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  filterDeployableFiles,
  detectFramework,
  sanitizeProjectName,
} from '@/lib/deploy';
import type { DeploymentResult, DeploymentStatus } from '@/lib/deploy';
import {
  saveVercelToken as saveTokenToServer,
  checkVercelToken,
  deployToVercel,
  checkDeploymentStatus,
} from '@/lib/vercel-client';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalState = 'token-setup' | 'ready' | 'deploying' | 'success' | 'error';

export function DeployModal({ isOpen, onClose }: DeployModalProps) {
  const { files, vercelProjectId, setVercelProjectId, setLastDeployUrl } = useStore();

  const [state, setState] = useState<ModalState>('token-setup');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);

  // Deploy state
  const [deployment, setDeployment] = useState<DeploymentResult | null>(null);
  const [deployStatus, setDeployStatus] = useState<DeploymentStatus | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived values
  const deployableFiles = filterDeployableFiles(files);
  const fileCount = Object.keys(deployableFiles).length;
  const framework = detectFramework(files);
  const projectName = sanitizeProjectName(
    files['package.json']
      ? (() => {
          try { return JSON.parse(files['package.json'].content).name || 'my-project'; } catch { return 'my-project'; }
        })()
      : 'my-project'
  );

  // Check token status on open
  useEffect(() => {
    if (!isOpen) return;

    const checkToken = async () => {
      setDeployment(null);
      setDeployStatus(null);
      setDeployError(null);

      try {
        const { hasToken, projectId } = await checkVercelToken();
        setHasStoredToken(hasToken);
        setStoredProjectId(projectId);
        setState(hasToken ? 'ready' : 'token-setup');
      } catch {
        setState('token-setup');
      }
    };

    checkToken();
  }, [isOpen]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) return;

    setTokenLoading(true);
    try {
      await saveTokenToServer(tokenInput.trim());
      setHasStoredToken(true);
      setTokenInput('');
      setState('ready');
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setTokenLoading(false);
    }
  };

  const handleDeploy = async () => {
    setState('deploying');
    setDeployError(null);
    setDeployStatus('QUEUED');

    try {
      const existingProjectId = vercelProjectId || storedProjectId || undefined;

      const result = await deployToVercel(files, projectName, framework, {
        projectId: existingProjectId,
      });

      setDeployment(result);
      setDeployStatus(result.readyState);

      if (result.projectId) {
        setVercelProjectId(result.projectId);
        setStoredProjectId(result.projectId);
      }

      if (result.readyState !== 'READY' && result.readyState !== 'ERROR') {
        startPolling(result.id);
      } else if (result.readyState === 'READY') {
        setLastDeployUrl(`https://${result.url}`);
        setState('success');
      } else {
        setDeployError(result.error || 'Deployment failed');
        setState('error');
      }
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
      setState('error');
    }
  };

  const startPolling = (deploymentId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const status = await checkDeploymentStatus(deploymentId);
        setDeployStatus(status.readyState);

        if (status.readyState === 'READY') {
          if (pollRef.current) clearInterval(pollRef.current);
          setLastDeployUrl(`https://${status.url}`);
          setDeployment((prev) => prev ? { ...prev, url: status.url } : prev);
          setState('success');
        } else if (status.readyState === 'ERROR' || status.readyState === 'CANCELED') {
          if (pollRef.current) clearInterval(pollRef.current);
          setDeployError(status.error || 'Deployment failed');
          setState('error');
        }
      } catch {
        // Continue polling on transient errors
      }
    }, 3000);
  };

  const handleCopyUrl = () => {
    if (!deployment?.url) return;
    navigator.clipboard.writeText(`https://${deployment.url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChangeToken = () => {
    setHasStoredToken(false);
    setState('token-setup');
  };

  if (!isOpen) return null;

  const frameworkLabel =
    framework === 'nextjs' ? 'Next.js' :
    framework === 'vite' ? 'Vite' :
    framework === 'create-react-app' ? 'Create React App' :
    'Static';

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
            <RiRocketLine className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">Deploy to Vercel</h2>
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
          {/* Token Setup State */}
          {state === 'token-setup' && (
            <>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Vercel API Token
                  </label>
                  <div className="relative">
                    <RiKeyLine className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
                      placeholder="Enter your Vercel token..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900/50 border border-white/[0.08] rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/45 focus:ring-1 focus:ring-white/[0.08]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>Get your token at</span>
                  <a
                    href="https://vercel.com/account/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-100 hover:text-white underline underline-offset-2"
                  >
                    vercel.com/account/tokens
                  </a>
                </div>

              </div>

              <button
                onClick={handleSaveToken}
                disabled={!tokenInput.trim() || tokenLoading}
                className={cn(
                  'w-full py-2 text-xs font-medium rounded-lg transition-all',
                  tokenInput.trim() && !tokenLoading
                    ? 'bg-zinc-50 text-zinc-950 hover:bg-white border border-white/[0.08]'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                )}
              >
                {tokenLoading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <RiLoader4Line className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save & Continue'
                )}
              </button>
            </>
          )}

          {/* Ready State */}
          {state === 'ready' && (
            <>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/[0.06]">
                  <span className="text-xs text-zinc-400">Project</span>
                  <span className="text-xs font-medium text-zinc-200">{projectName}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/[0.06]">
                  <span className="text-xs text-zinc-400">Framework</span>
                  <span className="text-xs font-medium text-zinc-200">{frameworkLabel}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50 border border-white/[0.06]">
                  <span className="text-xs text-zinc-400">Files</span>
                  <span className="text-xs font-medium text-zinc-200">{fileCount} files</span>
                </div>
                {storedProjectId && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                    <RiRefreshLine className="w-3 h-3 text-zinc-300" />
                    <span className="text-xs text-zinc-300">Redeployment — same project URL</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleDeploy}
                disabled={fileCount === 0}
                className={cn(
                  'w-full py-2.5 text-xs font-medium rounded-lg transition-all',
                  fileCount > 0
                    ? 'bg-zinc-50 text-zinc-950 hover:bg-white hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.35)] active:scale-[0.98] border border-white/[0.08]'
                    : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                )}
              >
                Deploy Now
              </button>

              <button
                onClick={handleChangeToken}
                className="w-full text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                Change token
              </button>
            </>
          )}

          {/* Deploying State */}
          {state === 'deploying' && (
            <div className="space-y-4 py-2">
              <div className="space-y-3">
                {/* Step 1: Upload */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    deployStatus !== 'QUEUED' ? 'bg-green-500/20' : 'bg-white/[0.08]'
                  )}>
                    {deployStatus !== 'QUEUED' ? (
                      <RiCheckLine className="w-3 h-3 text-green-400" />
                    ) : (
                      <RiLoader4Line className="w-3 h-3 text-zinc-200 animate-spin" />
                    )}
                  </div>
                  <span className={cn(
                    'text-xs',
                    deployStatus !== 'QUEUED' ? 'text-green-400' : 'text-zinc-200'
                  )}>
                    Uploading files
                  </span>
                </div>

                {/* Step 2: Build */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    deployStatus === 'READY' ? 'bg-green-500/20' :
                    deployStatus === 'BUILDING' ? 'bg-white/[0.08]' :
                    'bg-zinc-800'
                  )}>
                    {deployStatus === 'READY' ? (
                      <RiCheckLine className="w-3 h-3 text-green-400" />
                    ) : deployStatus === 'BUILDING' ? (
                      <RiLoader4Line className="w-3 h-3 text-zinc-200 animate-spin" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-zinc-600" />
                    )}
                  </div>
                  <span className={cn(
                    'text-xs',
                    deployStatus === 'READY' ? 'text-green-400' :
                    deployStatus === 'BUILDING' ? 'text-zinc-200' :
                    'text-zinc-600'
                  )}>
                    Building project
                  </span>
                </div>

                {/* Step 3: Live */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    deployStatus === 'READY' ? 'bg-green-500/20' : 'bg-zinc-800'
                  )}>
                    {deployStatus === 'READY' ? (
                      <RiCheckLine className="w-3 h-3 text-green-400" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-zinc-600" />
                    )}
                  </div>
                  <span className={cn(
                    'text-xs',
                    deployStatus === 'READY' ? 'text-green-400' : 'text-zinc-600'
                  )}>
                    Going live
                  </span>
                </div>
              </div>

              <p className="text-xs text-zinc-500 text-center">
                This may take a minute...
              </p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && deployment && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <RiCheckLine className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-sm font-medium text-zinc-100">Deployed successfully!</p>
              </div>

              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-800/50 border border-white/[0.06]">
                <span className="text-xs text-zinc-200 truncate flex-1 font-mono">
                  https://{deployment.url}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyUrl}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] transition-all"
                >
                  {copied ? (
                    <>
                      <RiCheckLine className="w-3.5 h-3.5 text-green-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <RiFileCopyLine className="w-3.5 h-3.5" />
                      Copy URL
                    </>
                  )}
                </button>
                <a
                  href={`https://${deployment.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-zinc-50 text-zinc-950 hover:bg-white border border-white/[0.08] transition-all"
                >
                  <RiExternalLinkLine className="w-3.5 h-3.5" />
                  Visit Site
                </a>
              </div>

              <button
                onClick={() => setState('ready')}
                className="w-full text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                Deploy Again
              </button>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <RiErrorWarningLine className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-red-400 mb-0.5">Deployment Failed</p>
                  <p className="text-xs text-red-400/80">
                    {deployError || 'An unknown error occurred'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setState('ready')}
                className="w-full py-2 text-xs font-medium rounded-lg bg-zinc-50 text-zinc-950 hover:bg-white border border-white/[0.08] transition-all"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-zinc-600">▲</span>
            <span className="text-xs text-zinc-500">Powered by Vercel</span>
          </div>
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
