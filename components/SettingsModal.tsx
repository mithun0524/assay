'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Key, ExternalLink, Settings2, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useAuthContext } from './Providers';
import { readEnvFile, writeEnvFile, type EnvVar } from '@/lib/envVars';
import { isAutocompleteEnabled, setAutocompleteEnabled } from '@/lib/autocomplete';
import { SnippetLibrary } from './SnippetLibrary';

type Tab = 'api-keys' | 'environment' | 'snippets';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTab?: Tab;
    onOpenShortcuts?: () => void;
}

export function SettingsModal({ isOpen, onClose, defaultTab = 'api-keys', onOpenShortcuts }: SettingsModalProps) {
    const { showDiffPreview, setShowDiffPreview, hasProject, viewTier, setViewTier } = useStore();
    const { user } = useAuthContext();
    const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

    // Always sync tab to defaultTab when modal opens
    useEffect(() => {
        if (isOpen) {
            setActiveTab(defaultTab);
        }
    }, [isOpen, defaultTab]);
    const [inputValue, setInputValue] = useState('');
    // The key itself never comes back to the browser — only a masked hint.
    const [keyHint, setKeyHint] = useState<string | null>(null);
    const [apiSaved, setApiSaved] = useState(false);
    const [envSaved, setEnvSaved] = useState(false);
    const [autocompleteOn, setAutocompleteOn] = useState(() => isAutocompleteEnabled());
    const inputRef = useRef<HTMLInputElement>(null);

    // Environment variables state
    const [envVars, setEnvVars] = useState<EnvVar[]>([]);
    const [loadingEnv, setLoadingEnv] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setInputValue('');
            setApiSaved(false);
            loadKeyHint();
            setEnvSaved(false);
            if (activeTab === 'api-keys') {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
            // Only load env vars if a project is active (WebContainer is booted)
            if (hasProject) {
                loadEnvVars();
            } else {
                setEnvVars([{ key: '', value: '' }]);
            }
        }
    }, [isOpen, hasProject]); // eslint-disable-line react-hooks/exhaustive-deps

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    const loadEnvVars = async () => {
        setLoadingEnv(true);
        try {
            const vars = await readEnvFile();
            setEnvVars(vars.length > 0 ? vars : [{ key: '', value: '' }]);
        } catch (error) {
            console.error('Failed to load .env file:', error);
            setEnvVars([{ key: '', value: '' }]);
        } finally {
            setLoadingEnv(false);
        }
    };

    const loadKeyHint = async () => {
        try {
            const res = await fetch('/api/user/secrets');
            if (!res.ok) return setKeyHint(null);
            const d = await res.json();
            setKeyHint(d.hasOpenrouterKey ? (d.openrouterKeyHint ?? 'configured') : null);
        } catch {
            setKeyHint(null);
        }
    };

    // The key is written straight to the user_secrets table and never touches
    // the browser again. It used to also live in localStorage, where any XSS
    // on the page could read it.
    const handleSave = async () => {
        const trimmed = inputValue.trim();
        if (!user) return;

        try {
            const res = await fetch('/api/user/secrets', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ openrouterKey: trimmed || null }),
            });
            if (!res.ok) return;
            setInputValue('');
            await loadKeyHint();
        } catch {
            return;
        }

        setApiSaved(true);
        setTimeout(() => onClose(), 600);
    };

    const handleSaveEnv = async () => {
        try {
            const validVars = envVars.filter(v => v.key.trim());
            await writeEnvFile(validVars);
            setEnvSaved(true);
            setTimeout(() => {
                setEnvSaved(false);
            }, 2000);
        } catch (error) {
            console.error('Failed to save .env file:', error);
        }
    };

    const addEnvVar = () => {
        setEnvVars([...envVars, { key: '', value: '' }]);
    };

    const removeEnvVar = (index: number) => {
        setEnvVars(envVars.filter((_, i) => i !== index));
    };

    const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...envVars];
        updated[index] = { ...updated[index], [field]: value };
        setEnvVars(updated);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-full max-w-md mx-4 rounded-2xl bg-[#111113] border border-white/[0.06] shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="border-b border-white/[0.06]">
                            <div className="flex items-center justify-between px-5 py-4">
                                <div className="flex items-center gap-2">
                                    <Settings2 className="w-4 h-4 text-zinc-400" />
                                    <h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
                                >
                                    <X className="w-4 h-4 text-zinc-500" />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-1 px-5">
                                <button
                                    onClick={() => setActiveTab('api-keys')}
                                    className={cn(
                                        'px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                                        activeTab === 'api-keys'
                                            ? 'text-zinc-50 bg-white/[0.06] border-b-2 border-zinc-100'
                                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <Key className="w-3.5 h-3.5" />
                                        API Keys
                                    </div>
                                </button>
                                <button
                                    onClick={() => setActiveTab('environment')}
                                    className={cn(
                                        'px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                                        activeTab === 'environment'
                                            ? 'text-zinc-50 bg-white/[0.06] border-b-2 border-zinc-100'
                                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                                    )}
                                >
                                    Environment
                                </button>
                                <button
                                    onClick={() => setActiveTab('snippets')}
                                    className={cn(
                                        'px-3 py-2 text-xs font-medium rounded-t-lg transition-all',
                                        activeTab === 'snippets'
                                            ? 'text-zinc-50 bg-white/[0.06] border-b-2 border-zinc-100'
                                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.02]'
                                    )}
                                >
                                    Snippets
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                            {activeTab === 'api-keys' && (
                                <>
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
                                            placeholder={keyHint ? `Saved · ${keyHint}` : 'sk-or-v1-...'}
                                            disabled={!user}
                                            className={cn(
                                                'w-full px-3 py-2.5 rounded-xl text-sm text-zinc-200',
                                                'bg-white/[0.04] border border-white/[0.06]',
                                                'focus:outline-none focus:border-white/45 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]',
                                                'placeholder:text-zinc-600',
                                                'transition-all'
                                            )}
                                        />
                                        <p className="mt-2 text-[11px] text-zinc-500">
                                            {!user
                                                ? 'Sign in to save a key. Keys are stored on the server, never in this browser.'
                                                : keyHint
                                                    ? 'Saved on the server. Enter a new key to replace it, or clear the field and save to remove it.'
                                                    : 'Stored on the server against your account — never in this browser.'}
                                        </p>
                                    </div>

                                    <a
                                        href="https://openrouter.ai/keys"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-xs text-zinc-100 hover:text-white transition-colors"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Get a free API key from OpenRouter
                                    </a>

                                    {/* Developer mode — controls which surfaces the
                                        workspace offers. See lib/surfaces.ts. */}
                                    <div className="pt-3 border-t border-white/[0.06]">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div>
                                                <div className="text-xs font-medium text-zinc-300 mb-0.5">
                                                    Developer mode
                                                </div>
                                                <div className="text-[11px] text-zinc-400">
                                                    Adds the Code and Logs tabs. Off by default — the app opens on your
                                                    build and your running app instead.
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={viewTier === 'developer'}
                                                onClick={() => setViewTier(viewTier === 'developer' ? 'simple' : 'developer')}
                                                className={cn(
                                                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                                                    viewTier === 'developer' ? 'bg-zinc-50' : 'bg-zinc-700'
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out',
                                                        viewTier === 'developer' ? 'translate-x-5 bg-zinc-900' : 'translate-x-0 bg-white'
                                                    )}
                                                />
                                            </button>
                                        </label>
                                    </div>

                                    {/* Diff Preview Toggle */}
                                    <div className="pt-3 border-t border-white/[0.06]">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div>
                                                <div className="text-xs font-medium text-zinc-300 mb-0.5">
                                                    Show diff before applying changes
                                                </div>
                                                <div className="text-[11px] text-zinc-600">
                                                    Preview and approve changes before they&apos;re applied to your project
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setShowDiffPreview(!showDiffPreview)}
                                                className={cn(
                                                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                                                    showDiffPreview ? 'bg-zinc-50' : 'bg-zinc-700'
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out',
                                                        showDiffPreview ? 'translate-x-5 bg-zinc-900' : 'translate-x-0 bg-white'
                                                    )}
                                                />
                                            </button>
                                        </label>
                                    </div>

                                    {/* AI Autocomplete Toggle */}
                                    <div className="pt-3 border-t border-white/[0.06]">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div>
                                                <div className="text-xs font-medium text-zinc-300 mb-0.5">
                                                    AI Autocomplete
                                                </div>
                                                <div className="text-[11px] text-zinc-600">
                                                    Show inline code suggestions as you type (ghost text)
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const next = !autocompleteOn;
                                                    setAutocompleteOn(next);
                                                    setAutocompleteEnabled(next);
                                                }}
                                                className={cn(
                                                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                                                    autocompleteOn ? 'bg-zinc-50' : 'bg-zinc-700'
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out',
                                                        autocompleteOn ? 'translate-x-5 bg-zinc-900' : 'translate-x-0 bg-white'
                                                    )}
                                                />
                                            </button>
                                        </label>
                                    </div>
                                </>
                            )}

                            {activeTab === 'environment' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-xs font-medium text-zinc-300">Environment Variables</h3>
                                            <p className="text-[11px] text-zinc-600 mt-0.5">
                                                Manage environment variables for your project (.env file)
                                            </p>
                                        </div>
                                        <button
                                            onClick={addEnvVar}
                                            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 hover:text-zinc-50 hover:bg-white/[0.06] rounded-lg transition-all"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add
                                        </button>
                                    </div>

                                    {loadingEnv ? (
                                        <div className="text-center py-8 text-xs text-zinc-500">
                                            Loading environment variables...
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {envVars.map((envVar, index) => (
                                                <div key={index} className="flex gap-2 items-start">
                                                    <input
                                                        type="text"
                                                        value={envVar.key}
                                                        onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                                                        placeholder="KEY"
                                                        className={cn(
                                                            'flex-1 px-3 py-2 rounded-lg text-xs text-zinc-200 font-mono',
                                                            'bg-white/[0.04] border border-white/[0.06]',
                                                            'focus:outline-none focus:border-white/45',
                                                            'placeholder:text-zinc-600',
                                                            'transition-all'
                                                        )}
                                                    />
                                                    <input
                                                        type="text"
                                                        value={envVar.value}
                                                        onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                                                        placeholder="value"
                                                        className={cn(
                                                            'flex-[2] px-3 py-2 rounded-lg text-xs text-zinc-200 font-mono',
                                                            'bg-white/[0.04] border border-white/[0.06]',
                                                            'focus:outline-none focus:border-white/45',
                                                            'placeholder:text-zinc-600',
                                                            'transition-all'
                                                        )}
                                                    />
                                                    <button
                                                        onClick={() => removeEnvVar(index)}
                                                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-white/[0.06] rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}

                                            {envVars.length === 0 && (
                                                <div className="text-center py-8 text-xs text-zinc-600">
                                                    No environment variables. Click &quot;Add&quot; to create one.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="pt-3 border-t border-white/[0.06]">
                                        <p className="text-[11px] text-zinc-600">
                                            These variables will be saved to <code className="text-zinc-300">.env</code> in your project root.
                                            Restart your dev server after making changes.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'snippets' && (
                                <SnippetLibrary />
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06]">
                            {onOpenShortcuts ? (
                                <button
                                    onClick={() => { onClose(); onOpenShortcuts(); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-all"
                                >
                                    <span className="text-[10px] font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">{typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '\u2318/' : 'Ctrl+/'}</span>
                                    Keyboard Shortcuts
                                </button>
                            ) : <div />}
                            <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-all"
                            >
                                {activeTab === 'snippets' ? 'Close' : 'Cancel'}
                            </button>
                            {activeTab !== 'snippets' && (
                                <button
                                    onClick={activeTab === 'api-keys' ? handleSave : handleSaveEnv}
                                    className={cn(
                                        'px-4 py-1.5 text-xs font-medium rounded-lg transition-all',
                                        (activeTab === 'api-keys' ? apiSaved : envSaved)
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-zinc-50 text-zinc-950 hover:bg-white'
                                    )}
                                >
                                    {(activeTab === 'api-keys' ? apiSaved : envSaved) ? '\u2713 Saved' : 'Save'}
                                </button>
                            )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
