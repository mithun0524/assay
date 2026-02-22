'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';

import 'xterm/css/xterm.css';

export function Terminal() {
    const terminalRef = useRef<HTMLDivElement>(null);
    const { setTerminalInstance } = useStore();
    const termRef = useRef<any>(null);

    useEffect(() => {
        let cancelled = false;
        let handleResize: (() => void) | null = null;
        let resizeObserver: ResizeObserver | null = null;

        const initTerminal = async () => {
            if (!terminalRef.current) return;

            // Clean up any previous terminal DOM content
            terminalRef.current.innerHTML = '';

            const { Terminal: XTerm } = await import('xterm');
            const { FitAddon } = await import('xterm-addon-fit');

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

            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current);

            // Only fit when the container has actual dimensions
            const safeFit = () => {
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
            };

            safeFit();

            // Restore content from store buffer
            const currentOutput = useStore.getState().terminalOutput;
            if (currentOutput) {
                term.write(currentOutput);
            }

            termRef.current = term;
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
