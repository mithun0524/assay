'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RiErrorWarningLine, RiRefreshLine } from '@remixicon/react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full flex items-center justify-center bg-[#0a0a0b]">
                    <div className="max-w-md mx-auto text-center space-y-4 px-6">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto">
                            <RiErrorWarningLine className="w-6 h-6 text-red-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-zinc-100">
                            Something went wrong
                        </h2>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            An unexpected error occurred. You can try to recover or reload the page.
                        </p>
                        {this.state.error && (
                            <pre className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-red-300 text-left overflow-auto max-h-32">
                                {this.state.error.message}
                            </pre>
                        )}
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 text-xs font-medium rounded-lg bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] border border-white/[0.06] transition-all"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-50 text-zinc-950 hover:bg-white transition-all"
                            >
                                <RiRefreshLine className="w-3 h-3" />
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
