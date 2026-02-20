'use client';

import { useRef, useEffect, useState } from 'react';
import { RefreshCw, Monitor, Terminal, Trash2, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type Tab = 'preview' | 'terminal';

export function PreviewPanel() {
  const { previewUrl, sandboxStatus, terminalOutput, clearTerminal } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [iframeKey, setIframeKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const terminalRef = useRef<HTMLPreElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const handleRefresh = () => {
    setIframeKey((k) => k + 1);
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const renderPreviewContent = () => {
    if (sandboxStatus === 'error') {
      return (
        <div className="h-full flex items-center justify-center bg-[#09090b]">
          <div className="text-center animate-fade-in">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-zinc-300 text-sm font-medium">Preview error</p>
            <p className="text-zinc-600 text-xs mt-1">Check the terminal for details</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 rounded-lg text-xs transition-all hover:scale-[1.02]"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (sandboxStatus === 'installing' || sandboxStatus === 'starting') {
      return (
        <div className="h-full flex items-center justify-center bg-[#09090b]">
          <div className="text-center animate-fade-up">
            <div className="relative mb-4">
              <Loader2 className="w-6 h-6 mx-auto text-violet-400 animate-spin" />
              <div className="absolute inset-0 w-6 h-6 mx-auto rounded-full bg-violet-500/20 blur-lg" />
            </div>
            <p className="text-zinc-300 text-sm font-medium">
              {sandboxStatus === 'installing' ? 'Installing dependencies' : 'Starting dev server'}
            </p>
            <div className="mt-2 flex items-center justify-center gap-1">
              <span className="w-1 h-1 rounded-full bg-violet-400/60 animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-violet-400/60 animate-pulse" style={{ animationDelay: '200ms' }} />
              <span className="w-1 h-1 rounded-full bg-violet-400/60 animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        </div>
      );
    }

    if (!previewUrl && sandboxStatus === 'idle') {
      return (
        <div className="h-full flex items-center justify-center bg-[#09090b]">
          <div className="text-center animate-fade-in">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <Monitor className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm">Preview</p>
            <p className="text-zinc-600 text-xs mt-1">Your app will appear here</p>
          </div>
        </div>
      );
    }

    if (previewUrl) {
      return (
        <div className="h-full flex flex-col">
          {/* URL bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] panel-header">
            <input
              type="text"
              value={previewUrl}
              readOnly
              className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1 text-xs text-zinc-500 focus:outline-none"
            />
            <button
              onClick={handleRefresh}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
              title="Refresh"
            >
              <RefreshCw className={cn(
                'w-3.5 h-3.5 text-zinc-500',
                isRefreshing && 'spin-once'
              )} />
            </button>
          </div>

          {/* Iframe */}
          <div className="flex-1 bg-white">
            <iframe
              key={iframeKey}
              src={previewUrl}
              allow="cross-origin-isolated"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="w-full h-full border-0"
            />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-[#09090b]">
      {/* Tab bar */}
      <div className="flex items-center border-b border-white/[0.06] panel-header">
        <button
          onClick={() => setActiveTab('preview')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs transition-all relative',
            activeTab === 'preview'
              ? 'text-zinc-200 tab-active'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Monitor className="w-3.5 h-3.5" />
          Preview
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 text-xs transition-all relative',
            activeTab === 'terminal'
              ? 'text-zinc-200 tab-active'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          <Terminal className="w-3.5 h-3.5" />
          Terminal
        </button>

        {activeTab === 'terminal' && (
          <button
            onClick={clearTerminal}
            className="ml-auto mr-2 p-1 hover:bg-white/[0.06] rounded-lg transition-all"
            title="Clear terminal"
          >
            <Trash2 className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 transition-colors" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'preview' ? (
          renderPreviewContent()
        ) : (
          <div className="h-full bg-[#09090b] p-3 overflow-auto">
            <pre ref={terminalRef} className="terminal-output text-zinc-400">
              {terminalOutput || '$ '}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}