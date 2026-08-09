'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    RiAddLine, RiDeleteBinLine, RiSearchLine,
    RiClipboardLine, RiCheckLine, RiCodeSSlashLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
    getSnippets, saveSnippet, deleteSnippet,
    DEFAULT_SNIPPETS, LANGUAGE_OPTIONS,
    type Snippet,
} from '@/lib/snippets';

interface SnippetLibraryProps {
    onInsert?: (code: string) => void;
}

export function SnippetLibrary({ onInsert }: SnippetLibraryProps) {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newLanguage, setNewLanguage] = useState('typescript');
    const [newCode, setNewCode] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        const loaded = getSnippets();
        if (loaded.length === 0) {
            // Initialize with defaults
            const initialized: Snippet[] = DEFAULT_SNIPPETS.map(s => ({
                ...s,
                id: crypto.randomUUID(),
                createdAt: Date.now(),
            }));
            localStorage.setItem('assay-snippets', JSON.stringify(initialized));
            setSnippets(initialized);
        } else {
            setSnippets(loaded);
        }
    }, []);

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return snippets;
        const q = searchQuery.toLowerCase();
        return snippets.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.language.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q)
        );
    }, [snippets, searchQuery]);

    const handleAdd = () => {
        if (!newName.trim() || !newCode.trim()) {
            toast.error('Name and code are required');
            return;
        }
        const snippet = saveSnippet({ name: newName.trim(), language: newLanguage, code: newCode });
        setSnippets(prev => [snippet, ...prev]);
        setNewName('');
        setNewCode('');
        setShowAddForm(false);
        toast.success('Snippet saved');
    };

    const handleDelete = (id: string) => {
        deleteSnippet(id);
        setSnippets(prev => prev.filter(s => s.id !== id));
        toast.success('Snippet deleted');
    };

    const handleCopy = async (snippet: Snippet) => {
        try {
            await navigator.clipboard.writeText(snippet.code);
            setCopiedId(snippet.id);
            toast.success('Copied to clipboard');
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            toast.error('Failed to copy to clipboard');
        }
    };

    const handleInsert = (snippet: Snippet) => {
        if (onInsert) {
            onInsert(snippet.code);
            toast.success(`Inserted "${snippet.name}"`);
        } else {
            handleCopy(snippet);
        }
    };

    return (
        <div className="space-y-3">
            {/* Search + Add */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search snippets..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded-lg placeholder:text-zinc-600 focus:outline-none focus:border-white/45"
                    />
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className={cn(
                        "p-1.5 rounded-lg transition-all",
                        showAddForm
                            ? "bg-white/[0.06] text-zinc-100"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]"
                    )}
                >
                    <RiAddLine className="w-4 h-4" />
                </button>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] space-y-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Snippet name"
                        className="w-full px-3 py-1.5 text-xs text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded-lg placeholder:text-zinc-600 focus:outline-none focus:border-white/45"
                    />
                    <select
                        value={newLanguage}
                        onChange={(e) => setNewLanguage(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded-lg focus:outline-none focus:border-white/45"
                    >
                        {LANGUAGE_OPTIONS.map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </select>
                    <textarea
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        placeholder="Paste your code snippet here..."
                        rows={4}
                        className="w-full px-3 py-2 text-xs text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded-lg placeholder:text-zinc-600 focus:outline-none focus:border-white/45 font-mono resize-none"
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setShowAddForm(false)}
                            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAdd}
                            className="px-3 py-1.5 text-xs text-zinc-950 bg-zinc-50 hover:bg-white rounded-lg transition-colors"
                        >
                            Save Snippet
                        </button>
                    </div>
                </div>
            )}

            {/* Snippet List */}
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {filtered.map((snippet) => (
                    <div
                        key={snippet.id}
                        className="group p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer"
                        onClick={() => handleInsert(snippet)}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                                <RiCodeSSlashLine className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <span className="text-xs font-medium text-zinc-300 truncate">{snippet.name}</span>
                                <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded shrink-0">
                                    {snippet.language}
                                </span>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCopy(snippet); }}
                                    className="p-1 text-zinc-500 hover:text-zinc-300 rounded-md transition-all"
                                    title="Copy"
                                >
                                    {copiedId === snippet.id
                                        ? <RiCheckLine className="w-3 h-3 text-emerald-400" />
                                        : <RiClipboardLine className="w-3 h-3" />
                                    }
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(snippet.id); }}
                                    className="p-1 text-zinc-500 hover:text-red-400 rounded-md transition-all"
                                    title="Delete"
                                >
                                    <RiDeleteBinLine className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                        <pre className="text-[11px] text-zinc-500 font-mono truncate leading-relaxed">
                            {snippet.code.split('\n')[0]}
                            {snippet.code.includes('\n') && '...'}
                        </pre>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="text-center py-6">
                        <RiCodeSSlashLine className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
                        <p className="text-xs text-zinc-500">
                            {searchQuery ? 'No snippets match your search' : 'No snippets yet. Click + to add one.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
