'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { RiSparklingLine, RiArrowRightLine, RiGridLine, RiDownloadLine } from '@remixicon/react';
import { useStore } from '@/lib/store';
import { useChat } from '@/hooks/useChat';
import { FREE_MODELS } from '@/lib/openrouter';
import { CustomDropdown } from './CustomDropdown';
import { cn } from '@/lib/utils';
import { TemplateGallery } from './TemplateGallery';
import { Template } from '@/lib/templates';
import { applyTemplate } from '@/lib/templateApplicator';
import { GitHubCloneDialog } from './GitHubCloneDialog';

const SUGGESTIONS = [
    'A task management app with drag-and-drop',
    'A real-time weather dashboard',
    'A markdown note-taking app',
    'A personal finance tracker',
];

const TYPEWRITER_PROMPTS = [
    'Build a Kanban board with real-time updates...',
    'Create a portfolio site with animations...',
    'Design a chat app with WebSockets...',
    'Make a recipe app with search and filtering...',
];

export function WelcomeScreen() {
    const { selectedModel, setSelectedModel } = useStore();
    const { submit } = useChat();
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [placeholderText, setPlaceholderText] = useState('');
    const [promptIndex, setPromptIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showTemplateGallery, setShowTemplateGallery] = useState(false);
    const [showCloneDialog, setShowCloneDialog] = useState(false);
    const [applyingTemplate, setApplyingTemplate] = useState(false);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
        }
    }, [input]);

    // Typewriter effect for placeholder
    useEffect(() => {
        if (input) return; // Stop when user is typing

        const currentPrompt = TYPEWRITER_PROMPTS[promptIndex];
        const speed = isDeleting ? 25 : 50;

        const timeout = setTimeout(() => {
            if (!isDeleting && charIndex < currentPrompt.length) {
                setPlaceholderText(currentPrompt.slice(0, charIndex + 1));
                setCharIndex(charIndex + 1);
            } else if (!isDeleting && charIndex === currentPrompt.length) {
                setTimeout(() => setIsDeleting(true), 2000);
            } else if (isDeleting && charIndex > 0) {
                setPlaceholderText(currentPrompt.slice(0, charIndex - 1));
                setCharIndex(charIndex - 1);
            } else if (isDeleting && charIndex === 0) {
                setIsDeleting(false);
                setPromptIndex((promptIndex + 1) % TYPEWRITER_PROMPTS.length);
            }
        }, speed);

        return () => clearTimeout(timeout);
    }, [charIndex, isDeleting, promptIndex, input]);

    const handleSubmit = useCallback(() => {
        if (input.trim()) {
            submit(input);
            setInput('');
        }
    }, [input, submit]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSuggestion = (text: string) => {
        submit(text);
    };

    const handleTemplateSelect = async (template: Template) => {
        setApplyingTemplate(true);
        try {
            await applyTemplate(template);
        } catch (error) {
            console.error('Failed to apply template:', error);
        } finally {
            setApplyingTemplate(false);
        }
    };

    return (
        <div className="h-screen w-screen flex flex-col relative overflow-hidden">
            {/* Animated gradient mesh background */}
            <div className="gradient-mesh" />

            {/* Minimal top bar */}
            <div className="relative z-10 h-12 px-5 flex items-center border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                    <RiSparklingLine className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-semibold text-zinc-100 tracking-tight">
                        DevForge
                    </span>
                </div>
            </div>

            {/* Centered content */}
            <div className="relative z-10 flex-1 flex items-center justify-center px-4">
                <div className="w-full max-w-2xl">
                    {/* Title */}
                    <h1 className="text-4xl font-semibold text-center mb-2.5 tracking-tight animate-fade-up gradient-text-subtle">
                        What do you want to build?
                    </h1>
                    <p className="text-sm text-zinc-500 text-center mb-8 animate-fade-up delay-100">
                        Describe your app and DevForge will generate the code, install dependencies, and show a live preview.
                    </p>

                    {/* Input area — glassmorphic */}
                    <div
                        className={cn(
                            'relative rounded-2xl animate-fade-up delay-200',
                            'glass-strong glow-border'
                        )}
                    >
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholderText || 'Build a...'}
                            className={cn(
                                'w-full bg-transparent px-5 pt-5 pb-16 text-sm text-zinc-100 resize-none',
                                'focus:outline-none',
                                'placeholder:text-zinc-600',
                                'min-h-[120px] max-h-[160px]',
                            )}
                            rows={3}
                        />

                        {/* Bottom bar inside textarea */}
                        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center justify-between">
                            <CustomDropdown
                                options={FREE_MODELS}
                                value={selectedModel}
                                onChange={setSelectedModel}
                                className="w-48"
                                dropUp
                            />

                            <button
                                onClick={handleSubmit}
                                disabled={!input.trim()}
                                className={cn(
                                    'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium',
                                    input.trim()
                                        ? 'btn-premium'
                                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                )}
                            >
                                Start
                                <RiArrowRightLine className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Suggestions */}
                    <div className="flex flex-wrap justify-center gap-2 mt-6">
                        {SUGGESTIONS.map((text, i) => (
                            <button
                                key={text}
                                onClick={() => handleSuggestion(text)}
                                className={cn(
                                    'px-3.5 py-2 text-xs text-zinc-400 rounded-xl',
                                    'glass glow-hover',
                                    'hover:text-zinc-200',
                                    'animate-fade-up',
                                )}
                                style={{ animationDelay: `${300 + i * 75}ms` }}
                            >
                                {text}
                            </button>
                        ))}
                    </div>

                    {/* Template and Clone buttons */}
                    <div className="mt-8 text-center">
                        <p className="text-xs text-zinc-500 mb-3">Or start from a template or GitHub repo</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setShowTemplateGallery(true)}
                                disabled={applyingTemplate}
                                className={cn(
                                    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium',
                                    'glass glow-hover',
                                    'text-zinc-300 hover:text-zinc-100',
                                    'animate-fade-up delay-500',
                                    applyingTemplate && 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <RiGridLine className="w-4 h-4" />
                                {applyingTemplate ? 'Loading Template...' : 'Browse Templates'}
                            </button>
                            <button
                                onClick={() => setShowCloneDialog(true)}
                                className={cn(
                                    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium',
                                    'glass glow-hover',
                                    'text-zinc-300 hover:text-zinc-100',
                                    'animate-fade-up delay-600'
                                )}
                            >
                                <RiDownloadLine className="w-4 h-4" />
                                Clone from GitHub
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Template Gallery Modal */}
            {showTemplateGallery && (
                <TemplateGallery
                    onSelectTemplate={handleTemplateSelect}
                    onClose={() => setShowTemplateGallery(false)}
                />
            )}

            {/* Clone Dialog */}
            <GitHubCloneDialog
                isOpen={showCloneDialog}
                onClose={() => setShowCloneDialog(false)}
            />
        </div>
    );
}
