'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  RiSendPlaneLine,
  RiStopFill,
  RiAddLine,
  RiTimeLine,
  RiArrowDownLine,
  RiSparklingLine,
  RiRobot2Line,
  RiFileCodeLine,
  RiArchiveLine,
  RiRocketLine,
  RiCheckboxCircleLine,
} from '@remixicon/react';
import { useStore } from '@/lib/store';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { CustomDropdown } from './CustomDropdown';
import { FREE_MODELS } from '@/lib/openrouter';
import { cn } from '@/lib/utils';
import { ImageUpload } from './ImageUpload';
import { ImagePreview } from './ImagePreview';
import { AgentBadge } from './AgentBadge';
import { AgentRole } from '@/lib/agents';

const QUICK_PROMPTS = [
  'A task management app',
  'A weather dashboard',
  'A markdown editor',
  'A landing page for a SaaS',
];

export function ChatPanel() {
  const {
    messages,
    isStreaming,
    selectedModel,
    setSelectedModel,
    clearMessages,
    clearFiles,
    clearTerminal,
    setPreviewUrl,
    setSandboxStatus,
    setHasProject,
    rateLimitUntil,
    setRateLimitUntil,
    tokenUsage,
    setCurrentProjectId,
    generationPhase,
    activelyWritingFile,
    activeAgent,
  } = useStore();

  const { submit, stop } = useChat();
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const modelLimit = FREE_MODELS.find(m => m.id === selectedModel)?.contextLength || 131072;
  const usagePercent = Math.min(100, (tokenUsage / modelLimit) * 100);
  const isNearLimit = usagePercent > 80;
  const isAtLimit = usagePercent > 95;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      // Only auto-scroll if user is near the bottom (within 150px)
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);

  // Track scroll position for FAB
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      setShowScrollFab(!isNearBottom && messages.length > 3);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  // Auto-focus textarea on mount and after streaming completes
  useEffect(() => {
    if (!isStreaming) {
      textareaRef.current?.focus();
    }
  }, [isStreaming]);

  // Rate-limit countdown timer
  useEffect(() => {
    if (!rateLimitUntil) {
      setRateLimitSeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((rateLimitUntil - Date.now()) / 1000));
      if (remaining <= 0) {
        setRateLimitUntil(null);
        setRateLimitSeconds(0);
      } else {
        setRateLimitSeconds(remaining);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [rateLimitUntil, setRateLimitUntil]);

  const isRateLimited = rateLimitSeconds > 0;

  const handleSubmit = () => {
    if ((input.trim() || images.length > 0) && !isStreaming) {
      submit(input, images);
      setInput('');
      setImages([]);
      // Scroll to bottom on send
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleRetry = useCallback(() => {
    // Find the last user message and resubmit
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg && !isStreaming) {
      submit(lastUserMsg.content);
    }
  }, [messages, isStreaming, submit]);

  const handleNewProject = async () => {
    clearMessages();
    clearFiles();
    clearTerminal();
    setPreviewUrl(null);
    setSandboxStatus('idle');
    setHasProject(false);
    setCurrentProjectId(null);
  };

  const handleQuickPrompt = (text: string) => {
    submit(text);
    setTimeout(scrollToBottom, 100);
  };

  const lastAssistantIndex = messages.map(m => m.role).lastIndexOf('assistant');
  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-[#09090b] relative">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <RiRobot2Line className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-medium text-zinc-400 tracking-wide uppercase">Chat</span>
          </div>

          {/* Token Usage */}
          {hasMessages && (
            <div className="flex items-center gap-1.5" title={`${tokenUsage.toLocaleString()} / ${modelLimit.toLocaleString()} tokens`}>
              <div className="w-12 h-1 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-400" : "bg-violet-500/70"
                  )}
                  style={{ width: `${Math.max(3, usagePercent)}%` }}
                />
              </div>
              <span className={cn(
                "text-[10px] font-medium",
                isAtLimit ? "text-red-400" : isNearLimit ? "text-amber-400" : "text-zinc-600"
              )}>
                {Math.round(usagePercent)}%
              </span>
            </div>
          )}
        </div>

        <button
          onClick={handleNewProject}
          className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-all"
          title="New Project"
        >
          <RiAddLine className="w-3 h-3" />
          New
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4 scroll-smooth relative"
      >
        {/* Empty state */}
        {!hasMessages && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4">
              <RiSparklingLine className="w-5 h-5 text-violet-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-300 mb-1">Start a conversation</h3>
            <p className="text-xs text-zinc-600 mb-5 max-w-[220px]">Describe what you want to build and I&apos;ll generate the code.</p>
            <div className="flex flex-col gap-1.5 w-full max-w-[240px]">
              {QUICK_PROMPTS.map((text) => (
                <button
                  key={text}
                  onClick={() => handleQuickPrompt(text)}
                  className="w-full px-3 py-2 text-xs text-zinc-400 text-left rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] hover:text-zinc-200 transition-all"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLastAssistant={index === lastAssistantIndex}
            isStreaming={isStreaming}
            onRetry={
              index === lastAssistantIndex &&
                (message.content.startsWith('Error:') || message.displayContent.startsWith('❌'))
                ? handleRetry
                : undefined
            }
          />
        ))}

        {/* Generation phase indicator (below messages, above input) */}
        {isStreaming && generationPhase !== 'idle' && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] animate-fade-in">
            {/* Active agent badge */}
            {activeAgent && (
              <AgentBadge role={activeAgent as AgentRole} showName={false} />
            )}
            {generationPhase === 'writing' && (
              <>
                <RiFileCodeLine className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                <span className="text-xs text-zinc-400">
                  Writing <span className="text-zinc-300 font-medium">{activelyWritingFile?.split('/').pop() || 'files'}</span>...
                </span>
              </>
            )}
            {generationPhase === 'installing' && (
              <>
                <RiArchiveLine className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-xs text-zinc-400">Installing dependencies...</span>
              </>
            )}
            {generationPhase === 'starting' && (
              <>
                <RiRocketLine className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span className="text-xs text-zinc-400">Starting dev server...</span>
              </>
            )}
            {generationPhase === 'done' && (
              <>
                <RiCheckboxCircleLine className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400">Ready</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Scroll-to-bottom FAB */}
      {showScrollFab && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-[120px] right-4 z-10 p-2 rounded-full bg-zinc-800/90 border border-white/[0.1] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 shadow-lg backdrop-blur-sm transition-all animate-fade-up"
          style={{ animationDuration: '0.2s' }}
        >
          <RiArrowDownLine className="w-4 h-4" />
        </button>
      )}

      {/* Input area */}
      <div className="px-3 py-2.5 border-t border-white/[0.06]">
        <div className={cn(
          'rounded-xl border border-white/[0.08] bg-white/[0.03]',
          'focus-within:border-violet-500/30 focus-within:bg-white/[0.04]',
          'transition-all duration-200'
        )}>
          {/* Image Preview */}
          {images.length > 0 && (
            <div className="px-3.5 pt-3">
              <ImagePreview
                images={images}
                onRemove={(index) => {
                  setImages(images.filter((_, i) => i !== index));
                }}
              />
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what to build..."
            disabled={isStreaming}
            className={cn(
              'w-full bg-transparent rounded-t-xl px-3.5 py-3 text-sm text-zinc-200 resize-none',
              'focus:outline-none',
              'placeholder:text-zinc-600',
              'min-h-[44px] max-h-[200px]',
              isStreaming && 'opacity-40 cursor-not-allowed'
            )}
            rows={1}
          />

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/[0.04]">
            <div className="flex items-center gap-2">
              {/* Inline model selector */}
              <CustomDropdown
                options={FREE_MODELS}
                value={selectedModel}
                onChange={setSelectedModel}
                className="w-44"
                dropUp
              />

              {/* Shift+Enter hint */}
              {input.includes('\n') || input.length > 60 ? null : (
                <span className="text-[10px] text-zinc-700 hidden sm:block">
                  Shift+Enter for new line
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Rate limit indicator */}
              {isRateLimited && (
                <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-amber-400/80 bg-amber-500/10 rounded-md">
                  <RiTimeLine className="w-3 h-3" />
                  {rateLimitSeconds}s
                </div>
              )}

              {/* Image Upload */}
              <ImageUpload
                onImagesAdded={(newImages) => {
                  setImages([...images, ...newImages]);
                }}
                currentImageCount={images.length}
                maxImages={4}
              />

              {/* Send / Stop */}
              {isStreaming ? (
                <button
                  onClick={stop}
                  className="p-2 bg-red-500/15 hover:bg-red-500/25 rounded-lg transition-all text-red-400"
                  title="Stop generating"
                >
                  <RiStopFill className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isRateLimited}
                  className={cn(
                    'p-2 rounded-lg transition-all',
                    input.trim() && !isRateLimited
                      ? 'bg-violet-500 hover:bg-violet-400 text-white shadow-lg shadow-violet-500/20'
                      : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
                  )}
                  title="Send message"
                >
                  <RiSendPlaneLine className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}