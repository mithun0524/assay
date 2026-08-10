'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { RiCodeLine, RiComputerLine, RiTerminalLine, RiRefreshLine, RiDeleteBinLine, RiLoader4Line, RiErrorWarningLine, RiSparklingLine, RiCloseLine, RiShutDownLine, RiPlayLine } from '@remixicon/react';
import { Smartphone, Tablet, Monitor, ExternalLink, Minus, Plus, AlertTriangle, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { visibleSurfaces, surfaceToFocus, type SurfaceId, type SurfaceState } from '@/lib/surfaces';
import { BuildSurface } from './BuildSurface';
import { useChat } from '@/hooks/useChat';
import { EditorPanel } from './EditorPanel';
import { cn } from '@/lib/utils';
import { Terminal as TerminalComponent } from './Terminal';
import { TerminalToolbar } from './TerminalToolbar';
import { restartDevServer } from '@/lib/fileSystem';

/** Static map so Tailwind/Turbopack can see every icon at build time. */
const SURFACE_ICON: Record<SurfaceId, React.ComponentType<{ className?: string }>> = {
    // Not a spinner. A tab is a place, not a status — and the status pill lives
    // three inches to the right in this same bar.
    preview: RiComputerLine,
    code: RiCodeLine,
    logs: RiTerminalLine,
};
type DevicePreset = 'mobile' | 'tablet' | 'desktop';

const DEVICE_WIDTHS: Record<DevicePreset, number | null> = {
    mobile: 375,
    tablet: 768,
    desktop: null, // 100%
};

export function WorkspacePanel() {
    const { previewUrl, sandboxStatus, terminalOutput, clearTerminal, previewErrors, addPreviewError, clearPreviewErrors, terminalErrors, clearTerminalErrors, generationPhase, activelyWritingFile, isStreaming, openTab } = useStore();
    const { submit } = useChat();

    // The visible surface is chosen by lib/surfaces, not by this component.
    // `picked` is the user's manual choice and wins while it is still offered;
    // auto-focus is a starting position, not a leash.
    const [picked, setPicked] = useState<SurfaceId | null>(null);
    const viewTier = useStore(s => s.viewTier);
    const fileCount = useStore(s => Object.keys(s.files).length);

    const hasError = sandboxStatus === 'error' || terminalErrors.length > 0 || previewErrors.length > 0;

    const surfaceState: SurfaceState = useMemo(() => ({
        fileCount,
        hasPreview: !!previewUrl,
        hasOutput: terminalOutput.length > 0,
        isStreaming,
        phase: generationPhase,
        hasError,
    }), [fileCount, previewUrl, terminalOutput.length, isStreaming, generationPhase, hasError]);

    const surfaces = useMemo(() => visibleSurfaces(viewTier, surfaceState), [viewTier, surfaceState]);
    const auto = useMemo(
        () => surfaceToFocus(viewTier, surfaceState, picked),
        [viewTier, surfaceState, picked],
    );

    // A manual pick holds until it stops being offered (tier change, file
    // deleted); otherwise the registry decides.
    const activeSurface: SurfaceId | null =
        picked && surfaces.some((s) => s.id === picked) ? picked : (auto ?? surfaces[0]?.id ?? null);

    // Once the turn ends, drop the manual pick so the next build can auto-focus
    // again rather than being pinned to wherever the user last was.
    useEffect(() => {
        if (!isStreaming) setPicked(null);
    }, [isStreaming]);

    const [iframeKey, setIframeKey] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRestarting, setIsRestarting] = useState(false);
    const [devicePreset, setDevicePreset] = useState<DevicePreset>('desktop');
    const [zoomLevel, setZoomLevel] = useState(100);

    // Follow the agent: open the file it is writing, so the editor shows the
    // code the transcript no longer does. Surface choice is handled by the
    // registry below, so this only opens the tab.
    useEffect(() => {
        if (activelyWritingFile) openTab(activelyWritingFile);
    }, [activelyWritingFile]); // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for errors from preview iframe via postMessage
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            // Only trust messages coming from the sandbox preview itself —
            // otherwise any page could inject fake errors straight into the
            // agent's auto-fix loop.
            if (!previewUrl) return;
            try {
                if (e.origin !== new URL(previewUrl).origin) return;
            } catch {
                return;
            }
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
    }, [addPreviewError, previewUrl]);

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

    // Errors used to force the terminal open here. That is now the `logs`
    // surface's own `focusWhen`, so it only happens for someone in the
    // developer tier — a beginner is not thrown into a stack trace.

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
                                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-50 hover:bg-white text-zinc-950 rounded-lg text-xs font-medium transition-all active:scale-[0.97] btn-shimmer"
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
                            <RiLoader4Line className="w-6 h-6 mx-auto text-zinc-400 animate-spin" />
                            <div className="absolute inset-0 w-6 h-6 mx-auto rounded-full bg-white/10 blur-lg" />
                        </div>
                        <p className="text-zinc-300 text-sm font-medium">
                            {sandboxStatus === 'installing' ? 'Installing dependencies' : 'Starting dev server'}
                        </p>
                        <div className="mt-2 flex items-center justify-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/40 dot-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-white/40 dot-bounce" style={{ animationDelay: '200ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-white/40 dot-bounce" style={{ animationDelay: '400ms' }} />
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
                            className="mt-4 flex items-center gap-2 px-4 py-2 bg-zinc-50 hover:bg-white text-zinc-950 rounded-lg text-xs font-medium transition-all"
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
                                    ? 'bg-white/[0.06] text-zinc-100'
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
                                    ? 'bg-white/[0.06] text-zinc-100'
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
                                    ? 'bg-white/[0.06] text-zinc-100'
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
                        {/* A WebContainer preview is served by a service worker
                            running in the tab that owns the container, so a bare
                            new tab has nothing behind the URL and lands on
                            StackBlitz's "connect this tab to its project"
                            screen. The button still works — you just have to
                            accept that handshake — but "Open in new window"
                            promised something it does not do, and every person
                            who clicked it read the result as a broken app. */}
                        <button
                            onClick={handleOpenInNewWindow}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
                            title="Open in a new tab — the tab has to reconnect to the sandbox first"
                            aria-label="Open preview in a new tab"
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
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-50 text-zinc-950 hover:bg-white transition-all active:scale-[0.97] btn-shimmer"
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
            {/* Tab bar — rendered from lib/surfaces, not hardcoded. Which tabs
                exist here is a function of tier and state; see SURFACES. */}
            <div className="flex items-center border-b border-white/[0.06] panel-header px-1">
                {/* One surface is not a choice, so it is not offered as one. The
                    row itself stays — it carries the live status and the panel
                    actions — but a lone "Preview" tab with nothing to switch to
                    is furniture. Developers, who have Code and Logs, still get
                    the tabs. */}
                {surfaces.length > 1 && surfaces.map((surface) => {
                    const Icon = SURFACE_ICON[surface.id];
                    const isActive = surface.id === activeSurface;
                    return (
                        <button
                            key={surface.id}
                            onClick={() => setPicked(surface.id)}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 text-xs transition-all relative',
                                isActive ? 'text-zinc-200 tab-active' : 'text-zinc-500 hover:text-zinc-300'
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {surface.label}
                            {surface.id === 'logs' && terminalErrors.length > 0 && (
                                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                            )}
                        </button>
                    );
                })}

                {/* Right side actions */}
                <div className="ml-auto flex items-center gap-1.5 pr-1">
                    {isStreaming && generationPhase !== 'idle' && generationPhase !== 'done' && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-zinc-300 bg-white/[0.04] rounded-md border border-white/[0.08]">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
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
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {/* Preview — one surface, two states. The running app once there
                    is one, the build illustration until then.

                    The app stays mounted even while another tab is showing:
                    unmounting the iframe reloads the running app and throws
                    away whatever state the user had clicked into. The build
                    illustration is the opposite — it only mounts when it is on
                    screen, so nothing animates behind a hidden pane.

                    A rebuild of an existing project keeps showing the old app
                    rather than dropping back to the illustration, which is what
                    every other builder does: the page hot-reloads under you. */}
                <div className={cn('h-full', activeSurface === 'preview' && previewUrl ? 'animate-fade-in' : 'hidden')} style={activeSurface === 'preview' && previewUrl ? { animationDuration: '0.15s' } : undefined}>
                    {renderPreviewContent()}
                </div>

                {activeSurface === 'preview' && !previewUrl && (
                    <div className="h-full animate-fade-in" style={{ animationDuration: '0.15s' }}>
                        <BuildSurface
                            phase={generationPhase}
                            hasError={hasError}
                            activelyWritingFile={activelyWritingFile}
                            fileCount={fileCount}
                            serverStarting={sandboxStatus === 'booting' || sandboxStatus === 'installing' || sandboxStatus === 'starting'}
                        />
                    </div>
                )}

                <div className={cn('h-full', activeSurface === 'code' ? 'animate-fade-in' : 'hidden')} style={activeSurface === 'code' ? { animationDuration: '0.15s' } : undefined}>
                    <EditorPanel />
                </div>

                {/* Terminal tab */}
                <div className={cn('h-full flex flex-col', activeSurface === 'logs' ? 'animate-fade-in' : 'hidden')} style={activeSurface === 'logs' ? { animationDuration: '0.15s' } : undefined}>
                    {terminalErrors.length > 0 && (
                        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="text-xs text-red-300 flex-1 truncate">
                                {terminalErrors.length} terminal error{terminalErrors.length > 1 ? 's' : ''} detected
                            </span>
                            <button
                                onClick={handleFixTerminalErrors}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-50 text-zinc-950 hover:bg-white transition-all active:scale-[0.97] btn-shimmer"
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

                    {/* Terminal toolbar */}
                    <TerminalToolbar />

                    <div className="flex-1 min-h-0">
                        <TerminalComponent />
                    </div>
                </div>
            </div>
        </div>
    );
}
