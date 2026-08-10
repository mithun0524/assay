'use client';

import { useEffect, useState, useRef } from 'react';
import {
  RiLoader4Line,
  RiSettings3Line,
  RiDownloadLine,
  RiFolderLine,
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiUploadLine,
  RiPaletteLine,
  RiKeyLine,
  RiShareLine,
  RiFileZipLine,
  RiStackLine,
  RiClipboardLine,
  RiArrowDownSLine,
  RiLayoutLine,
  RiArrowRightSLine,
} from '@remixicon/react';
import { AssayWordmark } from './Logo';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { downloadProject } from '@/lib/downloadProject';
import { generateStackBlitzUrl, copyProjectAsJson } from '@/lib/exportFormats';
import { SettingsModal } from './SettingsModal';
import { GitHubCommitDialog } from './GitHubCommitDialog';
import { GitHubAuthButton } from './GitHubAuthButton';
import { DeployModal } from './DeployModal';
import { ShareModal } from './ShareModal';
import { Tooltip } from './Tooltip';
import { useAuthContext } from './Providers';
import { ComponentLibrary } from './ComponentLibrary';

interface HeaderProps {
  onOpenProjects?: () => void;
  onOpenShortcuts?: () => void;
}

export function Header({ onOpenProjects, onOpenShortcuts }: HeaderProps) {
  const { sandboxStatus, files, canUndo, canRedo, undo, redo, designMode, setDesignMode } = useStore();
  const { user, isGitHubLinked } = useAuthContext();
  const [showSettings, setShowSettings] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'api-keys' | 'environment' | 'snippets'>('api-keys');
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);
  const [showRing, setShowRing] = useState(false);
  const prevStatusRef = useRef(sandboxStatus);
  const hasFiles = Object.keys(files).length > 0;

  // Status ring animation on status change
  useEffect(() => {
    if (prevStatusRef.current !== sandboxStatus) {
      prevStatusRef.current = sandboxStatus;
      setShowRing(true);
      const timer = setTimeout(() => setShowRing(false), 600);
      return () => clearTimeout(timer);
    }
  }, [sandboxStatus]);

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
      // Cmd+, → Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // zinc-500 measured 4.06:1 on this ground — under the 4.5:1 AA floor for
  // text this small. zinc-400 is 7.2:1.
  const statusConfig = {
    idle: { label: 'Ready', color: 'text-zinc-400', dot: 'bg-zinc-500', spinner: false },
    booting: { label: 'Booting', color: 'text-zinc-400', dot: 'bg-zinc-500', spinner: true },
    installing: { label: 'Installing', color: 'text-zinc-400', dot: 'bg-zinc-500', spinner: true },
    starting: { label: 'Starting', color: 'text-zinc-400', dot: 'bg-zinc-500', spinner: true },
    ready: { label: 'Live', color: 'text-emerald-400', dot: 'bg-emerald-400', spinner: false },
    error: { label: 'Error', color: 'text-rose-400', dot: 'bg-rose-400', spinner: false },
  };

  const config = statusConfig[sandboxStatus];
  const isError = sandboxStatus === 'error';

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? '\u2318' : 'Ctrl+';

  return (
    <>
      <header className="h-10 shrink-0 px-4 flex items-center justify-between glass border-b-0 z-20 relative"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <AssayWordmark className="text-[15px] text-zinc-100" />
          </div>
          {onOpenProjects && (
            <Tooltip content="Projects">
              <button
                onClick={onOpenProjects}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-colors"
              >
                <RiFolderLine className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Status. In the error case this is the only red thing on screen and
            the one thing you want to act on, so it stops being decoration and
            becomes a button. Every other state is passive, so it stays a
            plain span rather than advertising an interaction that does nothing. */}
        {(() => {
          const inner = (
            <>
              {config.spinner ? (
                <RiLoader4Line className="w-3 h-3 animate-spin" />
              ) : (
                <span className="relative flex items-center justify-center">
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    config.dot,
                    sandboxStatus === 'ready' && 'pulse-dot text-emerald-400'
                  )} />
                  {showRing && (
                    <span className={cn('absolute inset-0 rounded-full status-ring', config.dot)} />
                  )}
                </span>
              )}
              <AnimatePresence mode="wait">
                <motion.span
                  key={config.label}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                >
                  {config.label}
                </motion.span>
              </AnimatePresence>
            </>
          );

          if (!isError) {
            return (
              <div className={cn('flex items-center gap-1.5 text-xs px-2 py-1', config.color)}>
                {inner}
              </div>
            );
          }

          return (
            <Tooltip content="Show what went wrong">
              <button
                onClick={() => {
                  // Opening Settings was a guess, and usually the wrong one: a
                  // rate limit, an exhausted daily allowance and a withdrawn
                  // model all land here, and none are fixed by typing a key.
                  // The failing turn already says what happened, so go there.
                  window.dispatchEvent(new CustomEvent('assay:reveal-error'));
                }}
                className={cn(
                  'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg',
                  'border border-rose-400/30 bg-rose-400/[0.07]',
                  'hover:border-rose-400/50 hover:bg-rose-400/[0.12]',
                  config.color
                )}
              >
                {inner}
                <RiArrowRightSLine className="w-3.5 h-3.5 opacity-70" />
              </button>
            </Tooltip>
          );
        })()}

        <div className="flex items-center gap-1.5">
          {hasFiles && (
            <>
              <Tooltip content="Undo" shortcut={`${mod}Z`}>
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <RiArrowGoBackLine className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                </button>
              </Tooltip>
              <Tooltip content="Redo" shortcut={`${mod}\u21E7Z`}>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <RiArrowGoForwardLine className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                </button>
              </Tooltip>
              <div className="w-px h-4 bg-white/[0.06]" />
              <Tooltip content="Design Mode">
                <button
                  onClick={() => setDesignMode(!designMode)}
                  className={cn(
                    'p-1.5 rounded-lg transition-all',
                    designMode
                      ? 'bg-white/[0.09] text-zinc-100'
                      : 'hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <RiPaletteLine className="w-4 h-4" />
                </button>
              </Tooltip>
              <Tooltip content="UI Components">
                <button
                  onClick={() => setShowComponentLibrary(true)}
                  className={cn(
                    'p-1.5 rounded-lg transition-all',
                    'hover:bg-white/[0.06] text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <RiLayoutLine className="w-4 h-4" />
                </button>
              </Tooltip>
              <div className="w-px h-4 bg-white/[0.06]" />
            </>
          )}
          {hasFiles && user && isGitHubLinked && (
            <>
              <Tooltip content="Push to GitHub">
                <button
                  onClick={() => setShowCommitDialog(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
                >
                  <RiUploadLine className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition-colors" />
                  <span className="text-xs text-zinc-500 hover:text-zinc-300">Push</span>
                </button>
              </Tooltip>
              <div className="w-px h-4 bg-white/[0.06]" />
            </>
          )}
          <GitHubAuthButton />
          {hasFiles && (
            <Tooltip content="Environment Variables">
              <button
                onClick={() => { setSettingsTab('environment'); setShowSettings(true); }}
                className="px-2 py-1 hover:bg-white/[0.06] rounded-lg transition-all flex items-center gap-1"
              >
                <RiKeyLine className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[11px] text-zinc-500 font-mono">.env</span>
              </button>
            </Tooltip>
          )}
          <Tooltip content="Settings" shortcut={`${mod},`}>
            <button
              onClick={() => { setSettingsTab('api-keys'); setShowSettings(true); }}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
            >
              <RiSettings3Line className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
            </button>
          </Tooltip>
          {hasFiles && (
            <div className="relative">
              <Tooltip content="Export">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-0.5 p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
                >
                  <RiShareLine className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                  <RiArrowDownSLine className="w-3 h-3 text-zinc-600" />
                </button>
              </Tooltip>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-48 py-1.5 rounded-xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-lg shadow-xl z-50">
                    <button
                      onClick={() => { downloadProject(files); setShowExportMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] transition-colors"
                    >
                      <RiFileZipLine className="w-3.5 h-3.5 text-zinc-400" />
                      Download ZIP
                    </button>
                    <button
                      onClick={() => { generateStackBlitzUrl(files); setShowExportMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] transition-colors"
                    >
                      <RiStackLine className="w-3.5 h-3.5 text-zinc-400" />
                      Open in StackBlitz
                    </button>
                    <div className="mx-2 my-1 border-t border-white/[0.06]" />
                    <button
                      onClick={async () => {
                        try {
                          await copyProjectAsJson(files);
                          toast.success('Project copied to clipboard');
                        } catch {
                          toast.error('Failed to copy');
                        }
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] transition-colors"
                    >
                      <RiClipboardLine className="w-3.5 h-3.5 text-zinc-400" />
                      Copy as JSON
                    </button>
                    {user && (
                      <>
                        <div className="mx-2 my-1 border-t border-white/[0.06]" />
                        <button
                          onClick={() => { setShowShareModal(true); setShowExportMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] transition-colors"
                        >
                          <RiShareLine className="w-3.5 h-3.5 text-zinc-400" />
                          Share Project
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {/* Disabled Deploy used to be a near-invisible zinc-800 fill on a
              near-black bar, which reads as a rendering fault rather than a
              state. A dashed outline says "this is a real control that is not
              available yet", and the tooltip says why. */}
          <Tooltip content={hasFiles ? 'Deploy' : 'Build something first — there are no files to deploy'}>
            <button
              onClick={() => setShowDeployModal(true)}
              disabled={!hasFiles}
              className={cn(
                'px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all',
                hasFiles
                  ? 'btn-premium active:scale-[0.97]'
                  : 'border border-dashed border-white/[0.14] text-zinc-400 cursor-not-allowed disabled:opacity-100'
              )}
            >
              Deploy
            </button>
          </Tooltip>
        </div>
      </header>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} defaultTab={settingsTab} onOpenShortcuts={onOpenShortcuts} />
      <GitHubCommitDialog
        isOpen={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
      />
      <DeployModal isOpen={showDeployModal} onClose={() => setShowDeployModal(false)} />
      <ShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      <ComponentLibrary isOpen={showComponentLibrary} onClose={() => setShowComponentLibrary(false)} />
    </>
  );
}
