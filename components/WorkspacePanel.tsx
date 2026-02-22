'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { RiCodeLine, RiComputerLine, RiTerminalLine, RiRefreshLine, RiDeleteBinLine, RiLoader4Line, RiErrorWarningLine, RiSparklingLine, RiCloseLine, RiShutDownLine, RiPlayLine } from '@remixicon/react';
import { Smartphone, Tablet, Monitor, ExternalLink, Minus, Plus, AlertTriangle, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { useChat } from '@/hooks/useChat';
import { EditorPanel } from './EditorPanel';
import { cn } from '@/lib/utils';
import { Terminal as TerminalComponent } from './Terminal';
import { restartDevServer } from '@/lib/fileSystem';

type WorkspaceTab = 'code' | 'preview' | 'terminal';
type DevicePreset = 'mobile' | 'tablet' | 'desktop';

const DEVICE_WIDTHS: Record<DevicePreset, number | null> = {
    mobile: 375,
    tablet: 768,
    desktop: null, // 100%
};

export function WorkspacePanel() {
    const { previewUrl, sandboxStatus, terminalOutput, clearTerminal, previewErrors, addPreviewError, clearPreviewErrors, terminalErrors, clearTerminalErrors, generationPhase, activelyWritingFile, isStreaming } = useStore();
    const { submit } = useChat();
    const [activeTab, setActiveTab] = useState<WorkspaceTab>('code');
    const [iframeKey, setIframeKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRestarting, setIsRestarting] = useState(false);
    const [devicePreset, setDevicePreset] = useState<DevicePreset>('desktop');
    const [zoomLevel, setZoomLevel] = useState(100);

    // Auto-switch to code when file writing starts
    useEffect(() => {
        if (activelyWritingFile && activeTab !== 'code') {
            setActiveTab('code');
        }
    }, [activelyWritingFile]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-switch to preview when URL becomes available
    useEffect(() => {
        if (previewUrl && (activeTab === 'code' || activeTab === 'terminal')) {
            setActiveTab('preview');
        }
    }, [previewUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-switch to terminal during install/start
    useEffect(() => {
        if (generationPhase === 'installing' || generationPhase === 'starting') {
            setActiveTab('terminal');
        }
    }, [generationPhase]); // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for errors from preview iframe via postMessage
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data && typeof e.data === 'object') {
                // Handle our custom preview-error events
                if (e.data.type === 'preview-error') {
                    addPreviewError(e.data.message || 'Unknown error');
                }
                // Handle Vite HMR error events
                if (e.data.type === 'error' && e.data.err) {
                    const msg = e.data.err.message || e.data.err.stack || 'Unknown Vite error';
                    addPreviewError(msg);
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [addPreviewError]);

    // Clear preview errors when iframe refreshes
    const handleRefresh = () => {
        setIframeKey((k) => k + 1);
        setIsRefreshing(true);
        clearPreviewErrors();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleRestartServer = async () => {
        setIsRestarting(true);
        try {
            await restartDevServer();
            toast.success('Dev server restarted successfully');
        } catch (error) {
            console.error('Failed to restart dev server:', error);
            toast.error('Failed to restart dev server');
        } finally {
            setIsRestarting(false);
        }
    };

    const handleFixWithAI = useCallback(() => {
        const errorText = previewErrors.join('\n');
        clearPreviewErrors();
        submit(`I'm getting the following error(s) in my app preview. Please fix them:\n\n\`\`\`\n${errorText}\n\`\`\``);
    }, [previewErrors, clearPreviewErrors, submit]);

    const handleFixTerminalErrors = useCallback(() => {
        const errorText = terminalErrors.join('\n');
        clearTerminalErrors();
        submit(`I'm getting the following terminal error(s). Please fix them:\n\n\`\`\`\n${errorText}\n\`\`\``);
    }, [terminalErrors, clearTerminalErrors, submit]);

    // Auto-switch to terminal when errors are detected
    useEffect(() => {
        if (terminalErrors.length > 0 && activeTab !== 'terminal') {
            setActiveTab('terminal');
        }
    }, [terminalErrors.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleOpenInNewWindow = () => {
        if (previewUrl) {
            window.open(previewUrl, '_blank');
        }
    };

    const handleZoomIn = () => setZoomLevel(z => Math.min(z + 25, 150));
    const handleZoomOut = () => setZoomLevel(z => Math.max(z - 25, 50));

    const getPhaseLabel = (phase: string, writingFile: string | null) => {
        switch (phase) {
            case 'writing':
                return writingFile
                    ? `Writing ${writingFile.split('/').pop()}...`
                    : 'Analyzing your request...';
            case 'installing':
                return 'Installing packages...';
            case 'starting':
                return 'Starting your app...';
            default:
                return '';
        }
    };

    const renderPreviewContent = () => {
        if (sandboxStatus === 'error') {
            const hasErrors = previewErrors.length > 0 || terminalErrors.length > 0;
            const handleFixErrors = () => {
                const errors = previewErrors.length > 0 ? previewErrors : terminalErrors;
                const errorText = errors.join('\n');
                clearPreviewErrors();
                clearTerminalErrors();
                submit(`I'm getting the following error(s) in my app. Please fix them:\n\n\`\`\`\n${errorText}\n\`\`\``);
            };
            return (
                <div className="h-full flex items-center justify-center bg-[#09090b]">
                    <div className="text-center animate-fade-in">
                        <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
                            <RiComputerLine className="w-5 h-5 text-red-400" />
                        </div>
                        <p className="text-zinc-300 text-sm font-medium">Preview error</p>
                        <p className="text-zinc-600 text-xs mt-1">Check the terminal for details</p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                            {hasErrors && (
                                <button
                                    onClick={handleFixErrors}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-600/90 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-all active:scale-[0.97] btn-shimmer"
                                >
                                    <RiSparklingLine className="w-3.5 h-3.5" />
                                    Fix with AI
                                </button>
                            )}
                            <button
                                onClick={handleRefresh}
                                className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 rounded-lg text-xs transition-all hover:scale-[1.02]"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (sandboxStatus === 'installing' || sandboxStatus === 'starting') {
            return (
                <div className="h-full flex items-center justify-center bg-[#09090b] gradient-placeholder">
                    <div className="text-center animate-fade-up">
                        <div className="relative mb-4">
                            <RiLoader4Line className="w-6 h-6 mx-auto text-violet-400 animate-spin" />
                            <div className="absolute inset-0 w-6 h-6 mx-auto rounded-full bg-violet-500/20 blur-lg" />
                        </div>
                        <p className="text-zinc-300 text-sm font-medium">
                            {sandboxStatus === 'installing' ? 'Installing dependencies' : 'Starting dev server'}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 dot-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 dot-bounce" style={{ animationDelay: '200ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 dot-bounce" style={{ animationDelay: '400ms' }} />
                        </div>
                    </div>
                </div>
            );
        }

        if (!previewUrl) {
            return (
                <div className="h-full flex items-center justify-center bg-[#09090b]">
                    <div className="text-center animate-fade-in">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                            <RiComputerLine className="w-6 h-6 text-zinc-600" />
                        </div>
                        <p className="text-zinc-500 text-sm">Preview</p>
                        <p className="text-zinc-600 text-xs mt-1">Ready to start</p>
                        <button
                            onClick={handleRestartServer}
                            disabled={isRestarting}
                            className="mt-4 flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-all"
                        >
                            <RiPlayLine className="w-3.5 h-3.5 fill-current" />
                            Start Preview
                        </button>
                    </div>
                </div>
            );
        }

        const deviceWidth = DEVICE_WIDTHS[devicePreset];
        const isResponsive = devicePreset !== 'desktop';

        return (
            <div className="h-full flex flex-col">
                {/* URL bar */}
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.06] bg-[#09090b]">
                    <div className="flex-1 flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1">
                        <div className="w-2 h-2 rounded-full bg-green-500/50" />
                        <input
                            type="text"
                            value={previewUrl}
                            readOnly
                            className="flex-1 bg-transparent text-xs text-zinc-500 focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={handleRestartServer}
                        disabled={isRestarting}
                        className={cn(
                            "p-1.5 hover:bg-white/[0.06] rounded-lg transition-all text-zinc-500 hover:text-amber-400",
                            isRestarting && "opacity-50 cursor-not-allowed animate-pulse"
                        )}
                        title="Restart Dev Server"
                    >
                        <RiShutDownLine className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={handleRefresh}
                        className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
                        title="Refresh Preview"
                    >
                        <RiRefreshLine className={cn(
                            'w-3.5 h-3.5 text-zinc-500',
                            isRefreshing && 'spin-once'
                        )} />
                    </button>
                </div>

                {/* Device toolbar */}
                <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.06] bg-[#09090b]">
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => setDevicePreset('mobile')}
                            className={cn(
                                'p-1.5 rounded-lg transition-all text-xs',
                                devicePreset === 'mobile'
                                    ? 'bg-violet-500/15 text-violet-300'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
                            )}
                            title="Mobile (375px)"
                        >
                            <Smartphone className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setDevicePreset('tablet')}
                            className={cn(
                                'p-1.5 rounded-lg transition-all text-xs',
                                devicePreset === 'tablet'
                                    ? 'bg-violet-500/15 text-violet-300'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
                            )}
                            title="Tablet (768px)"
                        >
                            <Tablet className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setDevicePreset('desktop')}
                            className={cn(
                                'p-1.5 rounded-lg transition-all text-xs',
                                devicePreset === 'desktop'
                                    ? 'bg-violet-500/15 text-violet-300'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]'
                            )}
                            title="Desktop (100%)"
                        >
                            <Monitor className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="w-px h-4 bg-white/[0.06] mx-1" />

                    {/* Zoom controls */}
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={handleZoomOut}
                            disabled={zoomLevel <= 50}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all disabled:opacity-30"
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] text-zinc-500 w-8 text-center font-mono">{zoomLevel}%</span>
                        <button
                            onClick={handleZoomIn}
                            disabled={zoomLevel >= 150}
                            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all disabled:opacity-30"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="ml-auto">
                        <button
                            onClick={handleOpenInNewWindow}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
                            title="Open in new window"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Error banner */}
                {previewErrors.length > 0 && (
                    <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                        <RiErrorWarningLine className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span className="text-xs text-red-300 flex-1 truncate">
                            {previewErrors.length} error{previewErrors.length > 1 ? 's' : ''} detected
                        </span>
                        <button
                            onClick={handleFixWithAI}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-violet-600/90 text-white hover:bg-violet-500 transition-all active:scale-[0.97] btn-shimmer"
                        >
                            <RiSparklingLine className="w-3 h-3" />
                            Fix with AI
                        </button>
                        <button
                            onClick={clearPreviewErrors}
                            className="p-1 hover:bg-white/[0.06] rounded transition-all"
                        >
                            <RiCloseLine className="w-3 h-3 text-zinc-500" />
                        </button>
                    </div>
                )}

                {/* Iframe container */}
                <div className={cn(
                    'flex-1 overflow-auto',
                    isResponsive ? 'bg-zinc-950 flex justify-center' : 'bg-white'
                )}>
                    <div
                        className={cn(
                            'relative',
                            isResponsive && 'border border-white/[0.1] shadow-2xl rounded-lg overflow-hidden my-4 bg-white shrink-0'
                        )}
                        style={{
                            width: isResponsive && deviceWidth ? deviceWidth : '100%',
                            height: isResponsive ? 'calc(100% - 2rem)' : '100%',
                            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
                            transformOrigin: 'top center',
                        }}
                    >
                        {/* Mobile notch indicator */}
                        {devicePreset === 'mobile' && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 w-28 h-5 bg-black rounded-b-xl flex items-end justify-center pb-1">
                                <div className="w-12 h-1 bg-zinc-700 rounded-full" />
                            </div>
                        )}
                        <iframe
                            key={iframeKey}
                            src={previewUrl}
                            allow="cross-origin-isolated"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            className="w-full h-full border-0"
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#09090b]">
            {/* Tab bar */}
            <div className="flex items-center border-b border-white/[0.06] panel-header px-1">
                <button
                    onClick={() => setActiveTab('code')}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-2 text-xs transition-all relative',
                        activeTab === 'code'
                            ? 'text-zinc-200 tab-active'
                            : 'text-zinc-500 hover:text-zinc-300'
                    )}
                >
                    <RiCodeLine className="w-3.5 h-3.5" />
                    Code
                </button>
                <button
                    onClick={() => setActiveTab('preview')}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-2 text-xs transition-all relative',
                        activeTab === 'preview'
                            ? 'text-zinc-200 tab-active'
                            : 'text-zinc-500 hover:text-zinc-300'
                    )}
                >
                    <RiComputerLine className="w-3.5 h-3.5" />
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
                    <RiTerminalLine className="w-3.5 h-3.5" />
                    Terminal
                    {terminalErrors.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                </button>

                {/* Right side actions */}
                <div className="ml-auto flex items-center gap-1.5 pr-1">
                    {/* Generation phase indicator */}
                    {isStreaming && generationPhase !== 'idle' && generationPhase !== 'done' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-violet-300/80 bg-violet-500/10 rounded-md border border-violet-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                            <span className="truncate max-w-[150px]">
                                {getPhaseLabel(generationPhase, activelyWritingFile)}
                            </span>
                        </div>
                    )}
                    {generationPhase === 'done' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-emerald-300/80 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Done
                        </div>
                    )}

                    {activeTab === 'preview' && previewUrl && (
                        <button
                            onClick={handleRefresh}
                            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
                            title="Refresh preview"
                        >
                            <RiRefreshLine className={cn(
                                'w-3.5 h-3.5 text-zinc-500',
                                isRefreshing && 'spin-once'
                            )} />
                        </button>
                    )}
                    {activeTab === 'terminal' && (
                        <button
                            onClick={clearTerminal}
                            className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
                            title="Clear terminal"
                        >
                            <RiDeleteBinLine className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 transition-colors" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {/* Code tab */}
                <div className={cn('h-full', activeTab === 'code' ? 'animate-fade-in' : 'hidden')} style={activeTab === 'code' ? { animationDuration: '0.15s' } : undefined}>
                    <EditorPanel />
                </div>

                {/* Preview tab */}
                <div className={cn('h-full', activeTab === 'preview' ? 'animate-fade-in' : 'hidden')} style={activeTab === 'preview' ? { animationDuration: '0.15s' } : undefined}>
                    {renderPreviewContent()}
                </div>

                {/* Terminal tab */}
                <div className={cn('h-full flex flex-col', activeTab === 'terminal' ? 'animate-fade-in' : 'hidden')} style={activeTab === 'terminal' ? { animationDuration: '0.15s' } : undefined}>
                    {terminalErrors.length > 0 && (
                        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="text-xs text-red-300 flex-1 truncate">
                                {terminalErrors.length} terminal error{terminalErrors.length > 1 ? 's' : ''} detected
                            </span>
                            <button
                                onClick={handleFixTerminalErrors}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-violet-600/90 text-white hover:bg-violet-500 transition-all active:scale-[0.97] btn-shimmer"
                            >
                                <Sparkles className="w-3 h-3" />
                                Fix with AI
                            </button>
                            <button
                                onClick={clearTerminalErrors}
                                className="p-1 hover:bg-white/[0.06] rounded transition-all"
                            >
                                <X className="w-3 h-3 text-zinc-500" />
                            </button>
                        </div>
                    )}
                    <div className="flex-1 min-h-0">
                        <TerminalComponent />
                    </div>
                </div>
            </div>
        </div>
    );
}
