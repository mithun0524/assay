'use client';

import { useEffect, useState } from 'react';
import {
  RiGithubLine,
  RiLoader4Line,
  RiSparklingLine,
  RiSettings3Line,
  RiDownloadLine,
  RiFolderLine,
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiUploadLine,
  RiPaletteLine,
} from '@remixicon/react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { downloadProject } from '@/lib/downloadProject';
import { SettingsModal } from './SettingsModal';
import { GitHubCommitDialog } from './GitHubCommitDialog';
import { GitHubAuthButton } from './GitHubAuthButton';
import { DeployModal } from './DeployModal';

interface HeaderProps {
  onOpenProjects?: () => void;
}

export function Header({ onOpenProjects }: HeaderProps) {
  const { sandboxStatus, files, canUndo, canRedo, undo, redo, githubUser, designMode, setDesignMode } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const hasFiles = Object.keys(files).length > 0;

  // Keyboard shortcuts: Ctrl+Z → undo, Ctrl+Shift+Z → redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const statusConfig = {
    idle: { label: 'Ready', color: 'text-zinc-500', dot: 'bg-zinc-500', spinner: false },
    booting: { label: 'Booting', color: 'text-zinc-400', dot: 'bg-zinc-500', spinner: true },
    installing: { label: 'Installing', color: 'text-zinc-400', dot: 'bg-zinc-500', spinner: true },
    starting: { label: 'Starting', color: 'text-zinc-400', dot: 'bg-zinc-500', spinner: true },
    ready: { label: 'Live', color: 'text-emerald-400', dot: 'bg-emerald-400', spinner: false },
    error: { label: 'Error', color: 'text-red-400', dot: 'bg-red-400', spinner: false },
  };

  const config = statusConfig[sandboxStatus];

  return (
    <>
      <header className="h-11 shrink-0 px-4 flex items-center justify-between glass border-b-0 z-20 relative"
      >
        <div className="flex items-center gap-3">
          {onOpenProjects && (
            <button
              onClick={onOpenProjects}
              className="p-1.5 -ml-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-colors"
              title="Projects"
            >
              <RiFolderLine className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <RiSparklingLine className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-sm font-semibold text-zinc-100 tracking-tight">
              DevForge
            </span>
          </div>
        </div>

        <div className={cn('flex items-center gap-1.5 text-xs', config.color)}>
          {config.spinner ? (
            <RiLoader4Line className="w-3 h-3 animate-spin" />
          ) : (
            <span className={cn(
              'w-1.5 h-1.5 rounded-full',
              config.dot,
              sandboxStatus === 'ready' && 'pulse-dot text-emerald-400'
            )} />
          )}
          {config.label}
        </div>

        <div className="flex items-center gap-1.5">
          {hasFiles && (
            <>
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <RiArrowGoBackLine className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Shift+Z)"
              >
                <RiArrowGoForwardLine className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
              </button>
              <div className="w-px h-4 bg-white/[0.06]" />
              <button
                onClick={() => setDesignMode(!designMode)}
                className={cn(
                  'p-1.5 rounded-lg transition-all',
                  designMode
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300'
                )}
                title="Design Mode (Visual Editing)"
              >
                <RiPaletteLine className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-white/[0.06]" />
            </>
          )}
          {hasFiles && githubUser && (
            <>
              <button
                onClick={() => setShowCommitDialog(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
                title="Push to GitHub"
              >
                <RiUploadLine className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors" />
                <span className="text-xs text-zinc-500 hover:text-zinc-300">Push</span>
              </button>
              <div className="w-px h-4 bg-white/[0.06]" />
            </>
          )}
          <GitHubAuthButton />
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
            title="Settings"
          >
            <RiSettings3Line className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
          </button>
          {hasFiles && (
            <button
              onClick={() => downloadProject(files)}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
              title="Download project as ZIP"
            >
              <RiDownloadLine className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
            </button>
          )}
          <button
            onClick={() => setShowDeployModal(true)}
            disabled={!hasFiles}
            className={cn(
              'px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all',
              hasFiles
                ? 'bg-violet-600/90 text-white hover:bg-violet-500 hover:shadow-[0_0_20px_-5px_rgba(124,58,237,0.4)] active:scale-[0.97] border border-violet-500/30'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            )}
            title={hasFiles ? 'Deploy your project' : 'Create a project first'}
          >
            Deploy
          </button>
        </div>
      </header>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <GitHubCommitDialog
        isOpen={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
      />
      <DeployModal isOpen={showDeployModal} onClose={() => setShowDeployModal(false)} />
    </>
  );
}