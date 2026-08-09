'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  RiSendPlaneLine,
  RiStopFill,
  RiAddLine,
  RiTimeLine,
  RiArrowDownLine,
  RiRobot2Line,
  RiFileCodeLine,
  RiArchiveLine,
  RiRocketLine,
  RiCheckboxCircleLine,
  RiSideBarLine,
  RiGlobalLine,
  RiShieldCheckLine,
  RiLoader4Line,
  RiErrorWarningLine,
} from '@remixicon/react';
import Image from 'next/image';
import { AssayMark } from './Logo';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useChat } from '@/hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { CustomDropdown } from './CustomDropdown';
import { FREE_MODELS, VISION_SUPPORTED } from '@/lib/openrouter';
import { cn } from '@/lib/utils';
import { ImageUpload } from './ImageUpload';
import { ImagePreview } from './ImagePreview';
import { AgentBadge } from './AgentBadge';
import { AGENTS } from '@/lib/agents';
import type { AgentRole } from '@/lib/agents';
import { Tooltip } from './Tooltip';

interface ChatPanelProps {
  onCollapse?: () => void;
}

const QUICK_PROMPTS = [
  'A task management app',
  'A weather dashboard',
  'A markdown editor',
  'A landing page for a SaaS',
];

const PLACEHOLDERS = [
  'Build a todo app with drag and drop...',
  'Create a landing page with animations...',
  'Design a dashboard with charts...',
  'Make a real-time chat interface...',
  'Build an e-commerce product page...',
  'Create a blog with markdown support...',
];

/** Identity hues, from the same tokens the transcript avatars use. */
const AGENT_HUE: Record<AgentRole, string> = {
  architect: 'var(--agent-architect)',
  assistant: 'var(--agent-assistant)',
  coder: 'var(--agent-coder)',
  debugger: 'var(--agent-debugger)',
  designer: 'var(--agent-designer)',
  tester: 'var(--agent-tester)',
};

export function ChatPanel({ onCollapse }: ChatPanelProps) {
  // ── Fine-grained Zustand selectors — only re-render when these specific values change ──
  const messages = useStore(s => s.messages);
  const isStreaming = useStore(s => s.isStreaming);
  const selectedModel = useStore(s => s.selectedModel);
  const setSelectedModel = useStore(s => s.setSelectedModel);
  const rateLimitUntil = useStore(s => s.rateLimitUntil);
  const setRateLimitUntil = useStore(s => s.setRateLimitUntil);
  const tokenUsage = useStore(s => s.tokenUsage);
  const generationPhase = useStore(s => s.generationPhase);
  const activelyWritingFile = useStore(s => s.activelyWritingFile);
  // Selector returns a number, not the files object, so this does not re-render
  // the whole panel on every keystroke the agent writes into a file.
  const fileCount = useStore(s => Object.keys(s.files).length);
  const viewTier = useStore(s => s.viewTier);
  const activeAgent = useStore(s => s.activeAgent);
  const activeAgentReasoning = useStore(s => s.activeAgentReasoning);
  const qaStatus = useStore(s => s.qaStatus);
  const webSearchEnabled = useStore(s => s.webSearchEnabled);
  const setWebSearchEnabled = useStore(s => s.setWebSearchEnabled);

  const { submit, stop } = useChat();
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [queued, setQueued] = useState<{ text: string; images: string[] } | null>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  const modelLimit = FREE_MODELS.find(m => m.id === selectedModel)?.contextLength ?? 131072;
  const usagePercent = Math.min(100, (tokenUsage / modelLimit) * 100);
  const isNearLimit = usagePercent > 80;
  const isAtLimit = usagePercent > 95;

  const hasMessages = messages.length > 0;

  // Rotating placeholder
  useEffect(() => {
    if (hasMessages || input) return;
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [hasMessages, input]);

  // Scroll to bottom on initial mount / page refresh
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll to bottom when messages change — use instant scroll during streaming
  // to avoid smooth-scroll fighting with rapid updates
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      if (isNearBottom) {
        // Instant scroll during streaming, smooth otherwise
        if (isStreamingRef.current) {
          el.scrollTop = el.scrollHeight;
        } else {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
      }
    }
  }, [messages]);

  // Track scroll position for FAB
  const messagesLengthRef = useRef(messages.length);
  messagesLengthRef.current = messages.length;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
      setShowScrollFab(!isNearBottom && messagesLengthRef.current > 3);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []); // Register once, use ref for dynamic value

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

  // Flush a queued message once the current turn (including QA fixes) is done.
  useEffect(() => {
    if (isStreaming || !queued || isRateLimited) return;
    const next = queued;
    setQueued(null);
    submit(next.text, next.images);
    setTimeout(scrollToBottom, 100);
  }, [isStreaming, queued, isRateLimited, submit, scrollToBottom]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() && images.length === 0) return;

    // Sending mid-build used to silently do nothing. Queue it instead and send
    // the moment the current turn finishes.
    if (isStreaming) {
      setQueued({ text: input, images });
      setInput('');
      setImages([]);
      return;
    }

    submit(input, images);
    setInput('');
    setImages([]);
    setTimeout(scrollToBottom, 100);
  }, [input, images, isStreaming, submit, scrollToBottom]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault();
      stop();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, isStreaming, stop]);

  const handleRetry = useCallback(() => {
    // Find the last user message and resubmit
    const msgs = useStore.getState().messages;
    const lastUserMsg = [...msgs].reverse().find(m => m.role === 'user');
    if (lastUserMsg && !useStore.getState().isStreaming) {
      submit(lastUserMsg.content);
    }
  }, [submit]);

  const handleNewProject = useCallback(async () => {
    const s = useStore.getState();
    s.clearMessages();
    s.clearFiles();
    s.clearTerminal();
    s.setPreviewUrl(null);
    s.setSandboxStatus('idle');
    s.setHasProject(false);
    s.setCurrentProjectId(null);
  }, []);

  const handleQuickPrompt = useCallback((text: string) => {
    submit(text);
    setTimeout(scrollToBottom, 100);
  }, [submit, scrollToBottom]);

  // Memoize lastAssistantIndex — efficient reverse loop
  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[#09090b] relative">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {/* The active specialist is more useful here than the word "chat". */}
          {/* Same avatar chip the transcript uses, so the header names the
              active specialist in the same language as the turns below it.
              The old mono uppercase caption truncated to "ARCHITEC…" in a
              330px panel, which is not a name. */}
          <div className="flex items-center gap-2 min-w-0">
            {activeAgent ? (
              <span
                aria-hidden
                className="w-[18px] h-[18px] rounded-md shrink-0 grid place-items-center font-mono text-[9px] font-bold text-zinc-950"
                style={{ background: AGENT_HUE[activeAgent] }}
              >
                {AGENTS[activeAgent].name.charAt(0)}
              </span>
            ) : (
              <RiRobot2Line className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            )}
            <span className="text-[12px] font-semibold text-zinc-200 truncate">
              {activeAgent ? AGENTS[activeAgent].name : 'Chat'}
            </span>
          </div>

          {/* Token usage — developer telemetry, so it is developer-tier only.
              At 330px it also wrapped "1% context" onto two lines and pushed
              the agent name into an ellipsis. */}
          {hasMessages && viewTier === 'developer' && (
            <div className="flex items-center gap-1.5" title={`${tokenUsage.toLocaleString()} / ${modelLimit.toLocaleString()} tokens`}>
              <div className="w-16 h-1 bg-white/[0.10] rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    isAtLimit ? "bg-rose-400" : isNearLimit ? "bg-amber-400" : "bg-white/55"
                  )}
                  style={{ width: `${Math.max(3, usagePercent)}%` }}
                />
              </div>
              <span className={cn(
                "font-mono text-[10px]",
                isAtLimit ? "text-rose-400" : isNearLimit ? "text-amber-400" : "text-zinc-400"
              )}>
                {Math.round(usagePercent)}% context
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleNewProject}
            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-all"
            title="New Project"
          >
            <RiAddLine className="w-3 h-3" />
            New
          </button>
          {onCollapse && (
            <Tooltip content="Collapse Chat" shortcut="\u2318B">
              <button
                onClick={onCollapse}
                className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-lg transition-all"
              >
                <RiSideBarLine className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 relative"
      >
        {/* Empty state */}
        {!hasMessages && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-4">
              <AssayMark className="w-5 h-5 text-zinc-300" />
            </div>
            <h3 className="text-sm font-medium text-zinc-300 mb-1">Start a conversation</h3>
            <p className="text-xs text-zinc-600 mb-5 max-w-[220px]">Describe what you want to build and I&apos;ll generate the code.</p>
            <div className="flex flex-col gap-1.5 w-full max-w-[240px]">
              {QUICK_PROMPTS.map((text, index) => (
                <button
                  key={text}
                  onClick={() => handleQuickPrompt(text)}
                  className="stagger-item w-full px-3 py-2 text-xs text-zinc-400 text-left rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] hover:text-zinc-200 transition-all"
                  style={{ animationDelay: `${index * 75 + 200}ms` }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const isSameRole = prevMessage && prevMessage.role === message.role;
          return (
            <div key={message.id} className={index === 0 ? '' : isSameRole ? 'mt-1.5' : 'mt-4'}>
              <MessageBubble
                message={message}
                isLastAssistant={index === lastAssistantIndex}
                isStreaming={isStreaming}
                onRetry={
                  index === lastAssistantIndex && !isStreaming && message.role === 'assistant'
                    ? handleRetry
                    : undefined
                }
              />
            </div>
          );
        })}

        {/* QA gate result — what the QA agent found and did about it */}
        {qaStatus && (
          <div
            className={cn(
              'mt-2 flex items-start gap-2 px-2.5 py-2 rounded-lg border animate-fade-in',
              qaStatus.state === 'passed' && 'bg-emerald-500/[0.06] border-emerald-500/20',
              qaStatus.state === 'fixing' && 'bg-white/[0.04] border-white/[0.08]',
              qaStatus.state === 'failed' && 'bg-amber-500/[0.06] border-amber-500/20'
            )}
          >
            {qaStatus.state === 'passed' && <RiShieldCheckLine className="w-3.5 h-3.5 mt-px text-emerald-400 shrink-0" />}
            {qaStatus.state === 'fixing' && <RiLoader4Line className="w-3.5 h-3.5 mt-px text-zinc-400 animate-spin shrink-0" />}
            {qaStatus.state === 'failed' && <RiErrorWarningLine className="w-3.5 h-3.5 mt-px text-amber-400 shrink-0" />}
            <div className="min-w-0">
              <p className={cn(
                'text-xs font-medium',
                qaStatus.state === 'passed' && 'text-emerald-300',
                qaStatus.state === 'fixing' && 'text-zinc-300',
                qaStatus.state === 'failed' && 'text-amber-300'
              )}>
                {qaStatus.summary}
              </p>
              {qaStatus.state !== 'passed' && (
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {qaStatus.state === 'fixing'
                    ? `Auto-fix attempt ${qaStatus.attempt} of ${qaStatus.maxAttempts}`
                    : `Stopped after ${qaStatus.maxAttempts} attempts — tell me what you see and I'll dig in.`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live status. Pinned between the transcript and the composer rather than
          living inside the scroller: it is persistent status, not a transcript
          entry. Inside, it scrolled away with the history — and because the
          auto-scroll effect keys off `messages`, a phase change with no new
          tokens (installing, for one) never triggered a scroll, so it could
          sit below the fold exactly when it was the only thing moving.

          Suppressed while phase is 'writing' with no file yet.
          Suppressed while phase is 'writing' with no file yet: its fallback
          copy was "Analyzing your request...", which is the same thing the
          streaming message bubble above it already says with "Thinking...".
          It earns its place once it can name the file, or once the phase is
          something the bubble does not cover (searching, installing). */}
      {isStreaming && generationPhase !== 'idle' &&
        !(generationPhase === 'writing' && !activelyWritingFile) && (
        <div className="shrink-0 mx-3 mb-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] animate-fade-in">
          {/* Active agent badge */}
          {activeAgent && (
            <AgentBadge role={activeAgent} title={activeAgentReasoning ?? undefined} showName={false} />
          )}
          {generationPhase === 'writing' && (
            <>
              <RiFileCodeLine className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />
              <span className="text-xs shimmer-text">
                Writing <span className="font-medium">{activelyWritingFile?.split('/').pop()}</span>
              </span>
              {/* The count is what replaces the list of file cards that used
                  to sit in the transcript: it is the only thing that told you
                  how big this turn is. Files in the project, so it keeps
                  climbing across turns rather than resetting. */}
              {fileCount > 0 && (
                <span className="ml-auto font-mono text-[10px] text-zinc-400 tabular-nums">
                  {fileCount} {fileCount === 1 ? 'file' : 'files'}
                </span>
              )}
            </>
          )}
          {generationPhase === 'searching' && (
            <>
              <RiGlobalLine className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />
              <span className="text-xs text-zinc-400">Searching the web...</span>
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
              <RiRocketLine className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />
              <span className="text-xs text-zinc-400">Starting dev server...</span>
            </>
          )}
          {generationPhase === 'verifying' && (
            <>
              <RiShieldCheckLine className="w-3.5 h-3.5 text-zinc-400 animate-pulse" />
              <span className="text-xs text-zinc-400">QA agent is testing your app...</span>
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
      {queued && (
        <div className="mx-3 mb-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03]">
          <RiTimeLine className="w-3 h-3 text-zinc-500 shrink-0" />
          <span className="font-mono text-[10px] text-zinc-400 truncate">Queued · sends when this build finishes</span>
          <button
            onClick={() => { setInput(queued.text); setImages(queued.images); setQueued(null); }}
            className="ml-auto font-mono text-[10px] text-zinc-500 hover:text-zinc-200 shrink-0"
          >
            Edit
          </button>
        </div>
      )}
      <div className="px-3 pb-3 pt-2 border-t border-white/[0.06] bg-gradient-to-b from-transparent to-black/20">
        <div className={cn(
          'rounded-xl border border-white/[0.07] bg-white/[0.025] overflow-hidden',
          'focus-within:border-white/45 focus-within:bg-white/[0.04]',
          'focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
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

          {/* Textarea with rotating placeholder */}
          <div className="relative">
            {!hasMessages && !input && (
              <div className="absolute inset-0 flex items-center px-3.5 py-3 pointer-events-none">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={placeholderIdx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm text-zinc-600"
                  >
                    {PLACEHOLDERS[placeholderIdx]}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasMessages ? 'Describe what to build...' : ''}
              className={cn(
                'w-full bg-transparent rounded-t-xl px-3.5 py-3 text-sm text-zinc-200 resize-none',
                'focus:outline-none',
                'placeholder:text-zinc-600',
                'min-h-[44px] max-h-[200px]'
              )}
              rows={1}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {/* Inline model selector */}
              <CustomDropdown
                options={FREE_MODELS}
                value={selectedModel}
                onChange={setSelectedModel}
                className="min-w-0 max-w-[9.5rem]"
                dropUp
              />

              {/* Web search toggle */}
              <Tooltip content="Always research the web first. When off, the agent still searches on its own whenever it is unsure.">
                <button
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                  className={cn(
                    'p-1.5 rounded-lg transition-all',
                    webSearchEnabled
                      ? 'bg-white/[0.06] text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                  )}
                  title="Always research first"
                >
                  <RiGlobalLine className="w-4.5 h-4.5" />
                </button>
              </Tooltip>

            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Rate limit indicator */}
              {isRateLimited && (
                <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-amber-400/80 bg-amber-500/10 rounded-md">
                  <RiTimeLine className="w-3 h-3" />
                  {rateLimitSeconds}s
                </div>
              )}

              {/* Image upload — hidden while every allow-listed model is text-only,
                  since the API strips image parts before sending anyway. */}
              {VISION_SUPPORTED && (
              <ImageUpload
                onImagesAdded={(newImages) => {
                  setImages([...images, ...newImages]);
                }}
                currentImageCount={images.length}
                maxImages={4}
              />
              )}

              {/* Send / Stop */}
              {isStreaming ? (
                <button
                  onClick={stop}
                  className="p-2 bg-red-500/15 hover:bg-red-500/25 rounded-xl transition-all text-red-400"
                  title="Stop generating"
                >
                  <RiStopFill className="w-4.5 h-4.5" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={(!input.trim() && images.length === 0) || isRateLimited}
                  className={cn(
                    'p-2 rounded-xl transition-all',
                    (input.trim() || images.length > 0) && !isRateLimited
                      ? 'bg-zinc-50 hover:bg-white text-zinc-950 shadow-lg shadow-white/10 pulse-glow'
                      : 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
                  )}
                  title="Send message"
                >
                  <RiSendPlaneLine className="w-4.5 h-4.5" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-1 pt-1.5">
          <span className="font-mono text-[10px] text-zinc-700">
            <kbd className="text-zinc-600">Enter</kbd> send · <kbd className="text-zinc-600">Shift+Enter</kbd> new line
          </span>
          {isStreaming && (
            <span className="font-mono text-[10px] text-zinc-600">Esc to stop</span>
          )}
        </div>
      </div>
    </div>
  );
}
