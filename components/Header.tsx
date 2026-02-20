'use client';

import { useState } from 'react';
import { Github, Loader2, Sparkles, Settings, Download, Folder } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { downloadProject } from '@/lib/downloadProject';
import { SettingsModal } from './SettingsModal';

interface HeaderProps {
  onOpenProjects?: () => void;
}

export function Header({ onOpenProjects }: HeaderProps) {
  const { sandboxStatus, files } = useStore();
  const [showSettings, setShowSettings] = useState(false);
  const hasFiles = Object.keys(files).length > 0;

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
              <Folder className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-sm font-semibold text-zinc-100 tracking-tight">
              DevForge
            </span>
          </div>
        </div>

        <div className={cn('flex items-center gap-1.5 text-xs', config.color)}>
          {config.spinner ? (
            <Loader2 className="w-3 h-3 animate-spin" />
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
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
          </button>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
          >
            <Github className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
          </a>
          {hasFiles && (
            <button
              onClick={() => downloadProject(files)}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
              title="Download project as ZIP"
            >
              <Download className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
            </button>
          )}
          <a
            href="https://vercel.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all',
              'bg-violet-600/90 text-white',
              'hover:bg-violet-500 hover:shadow-[0_0_20px_-5px_rgba(124,58,237,0.4)]',
              'active:scale-[0.97]',
              'border border-violet-500/30'
            )}
          >
            Deploy
          </a>
        </div>
      </header>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}