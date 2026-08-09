'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

import '@xterm/xterm/css/xterm.css';

export function Terminal() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const { setTerminalInstance } = useStore();
    const termRef = useRef<any>(null);

    useEffect(() => {
        let cancelled = false;
        let handleResize: (() => void) | null = null;
        let resizeObserver: ResizeObserver | null = null;
        let fitFrame: number | null = null;

        const initTerminal = async () => {
            if (!terminalRef.current) return;

            // Clean up any previous terminal DOM content
            terminalRef.current.innerHTML = '';

            const { Terminal: XTerm } = await import('@xterm/xterm');
            const { FitAddon } = await import('@xterm/addon-fit');

            if (cancelled) return;

            const term = new XTerm({
                cursorBlink: true,
                convertEol: true,
                theme: {
                    background: '#09090b',
                    foreground: '#a1a1aa',
                    cursor: '#a1a1aa',
                    selectionBackground: 'rgba(255, 255, 255, 0.2)',
                },
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                lineHeight: 1.4,
            });

            // Registered before anything else can happen to it. This used to be
            // assigned further down, after open() and the first write, so an
            // unmount landing in that window found termRef.current still null,
            // skipped dispose() entirely, and leaked a live terminal attached to
            // a node that had just been detached.
            termRef.current = term;

            if (cancelled) {
                term.dispose();
                termRef.current = null;
                return;
            }

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current);

            // Only fit when the container has actual dimensions, and at most
            // once per frame.
            //
            // A ResizeObserver fires per observed change, and every fit() makes
            // xterm's Viewport queue an internal refresh, so dragging the panel
            // divider used to queue one full refresh per pixel. One per frame is
            // all a terminal can draw anyway.
            //
            // This also used to be a crash: xterm 5.3's Viewport could run a
            // queued _innerRefresh after dispose() had nulled its render
            // service, throwing "Cannot read properties of undefined (reading
            // 'dimensions')". Coalescing narrowed the window but could not close
            // it, because the timer was the library's own. Fixed properly by
            // moving to @xterm/xterm, which supersedes the deprecated `xterm`.
            const safeFit = () => {
                if (fitFrame !== null) cancelAnimationFrame(fitFrame);
                fitFrame = requestAnimationFrame(() => {
                    fitFrame = null;
                    try {
                        if (
                            !cancelled &&
                            terminalRef.current &&
                            terminalRef.current.offsetWidth > 0 &&
                            terminalRef.current.offsetHeight > 0
                        ) {
                            fitAddon.fit();
                        }
                    } catch {
                        // Ignore fit errors from renderer not being ready
                    }
                });
            };

            safeFit();

            // Restore content from store buffer
            const currentOutput = useStore.getState().terminalOutput;
            if (currentOutput) {
                term.write(currentOutput);
            }

            setTerminalInstance(term);

            handleResize = safeFit;
            window.addEventListener('resize', handleResize);

            // Also refit when the container itself resizes (e.g. panel collapse/expand)
            resizeObserver = new ResizeObserver(() => {
                if (!cancelled) safeFit();
            });
            resizeObserver.observe(terminalRef.current);

            setTimeout(() => safeFit(), 100);
        };

        initTerminal();

        return () => {
            cancelled = true;
            // Drop the queued fit before disposing, so we are not handing xterm
            // a refresh to run against a terminal that is about to be gone.
            if (fitFrame !== null) { cancelAnimationFrame(fitFrame); fitFrame = null; }
            if (handleResize) window.removeEventListener('resize', handleResize);
            if (resizeObserver) resizeObserver.disconnect();
            if (termRef.current) {
                termRef.current.dispose();
                termRef.current = null;
                setTerminalInstance(null);
            }
            if (terminalRef.current) {
                terminalRef.current.innerHTML = '';
            }
        };
    }, [setTerminalInstance]);

    return (
        <div
            ref={terminalRef}
            className="h-full w-full bg-[#09090b] pl-2 pt-2 overflow-hidden"
            style={{ minHeight: '100px' }}
        />
    );
}
