'use client';

import { useState, useEffect, useRef } from 'react';
import { RiCloseLine, RiKeyLine, RiExternalLinkLine } from '@remixicon/react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { apiKey, setApiKey, showDiffPreview, setShowDiffPreview } = useStore();
    const [inputValue, setInputValue] = useState(apiKey ?? '');
    const [saved, setSaved] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setInputValue(apiKey ?? '');
            setSaved(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, apiKey]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSave = () => {
        const trimmed = inputValue.trim();
        setApiKey(trimmed || null);
        setSaved(true);
        setTimeout(() => onClose(), 600);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-md mx-4 rounded-2xl bg-[#111113] border border-white/[0.08] shadow-2xl animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <RiKeyLine className="w-4 h-4 text-violet-400" />
                        <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
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
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                            OpenRouter API Key
                        </label>
                        <input
                            ref={inputRef}
                            type="password"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            placeholder="sk-or-v1-..."
                            className={cn(
                                'w-full px-3 py-2.5 rounded-xl text-sm text-zinc-200',
                                'bg-white/[0.04] border border-white/[0.08]',
                                'focus:outline-none focus:border-violet-500/40 focus:shadow-[0_0_0_1px_rgba(124,58,237,0.15)]',
                                'placeholder:text-zinc-600',
                                'transition-all'
                            )}
                        />
                        <p className="mt-2 text-[11px] text-zinc-600">
                            Your key is stored locally in your browser and never sent to our servers.
                        </p>
                    </div>

                    <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                        <RiExternalLinkLine className="w-3 h-3" />
                        Get a free API key from OpenRouter
                    </a>

                    {/* Diff Preview Toggle */}
                    <div className="pt-3 border-t border-white/[0.06]">
                        <label className="flex items-center justify-between cursor-pointer">
                            <div>
                                <div className="text-xs font-medium text-zinc-300 mb-0.5">
                                    Show diff before applying changes
                                </div>
                                <div className="text-[11px] text-zinc-600">
                                    Preview and approve changes before they're applied to your project
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDiffPreview(!showDiffPreview)}
                                className={cn(
                                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                                    showDiffPreview ? 'bg-violet-600' : 'bg-zinc-700'
                                )}
                            >
                                <span
                                    className={cn(
                                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                                        showDiffPreview ? 'translate-x-5' : 'translate-x-0'
                                    )}
                                />
                            </button>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
                    <button
                        onClick={onClose}
                        className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className={cn(
                            'px-4 py-1.5 text-xs font-medium rounded-lg transition-all',
                            saved
                                ? 'bg-emerald-600 text-white'
                                : 'bg-violet-600/90 text-white hover:bg-violet-500'
                        )}
                    >
                        {saved ? '✓ Saved' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
