'use client';

import { useMemo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import { RiClipboardLine, RiCheckLine, RiRobot2Line, RiUser3Line, RiArrowDownSLine, RiArrowUpSLine, RiErrorWarningLine, RiRefreshLine, RiLoader4Line } from '@remixicon/react';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/store';
import { toast } from 'sonner';

interface MessageBubbleProps {
  message: Message;
  isLastAssistant: boolean;
  isStreaming: boolean;
  onRetry?: () => void;
}

const COLLAPSE_THRESHOLD = 1500; // characters

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 10000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-all"
    >
      {copied ? (
        <>
          <RiCheckLine className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <RiClipboardLine className="w-3 h-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1 ml-1">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

export function MessageBubble({ message, isLastAssistant, isStreaming, onRetry }: MessageBubbleProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const isUser = message.role === 'user';
  const isError = message.displayContent.startsWith('❌') || message.content.startsWith('Error:');
  const isLong = message.displayContent.length > COLLAPSE_THRESHOLD;
  const isEmpty = !message.displayContent.trim();

  const timeAgo = useMemo(() => relativeTime(message.timestamp), [message.timestamp]);

  const displayText = useMemo(() => {
    if (isLong && isCollapsed && !isStreaming) {
      return message.displayContent.slice(0, COLLAPSE_THRESHOLD) + '…';
    }
    return message.displayContent;
  }, [message.displayContent, isLong, isCollapsed, isStreaming]);

  // ── USER MESSAGE ──
  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-up" style={{ animationDuration: '0.3s' }}>
        <div className="max-w-[85%] flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600">{timeAgo}</span>
            <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center">
              <RiUser3Line className="w-3 h-3 text-violet-400" />
            </div>
          </div>
          <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-md bg-violet-500/15 border border-violet-500/20 text-sm text-zinc-200 leading-relaxed">
            {message.displayContent}
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR MESSAGE ──
  if (isError) {
    return (
      <div className="flex gap-2.5 animate-fade-up" style={{ animationDuration: '0.3s' }}>
        <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <RiErrorWarningLine className="w-3.5 h-3.5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="px-3.5 py-3 rounded-2xl rounded-tl-md bg-red-500/[0.08] border border-red-500/20">
            <p className="text-sm text-red-300/90 leading-relaxed">{message.displayContent.replace(/^❌\s*\*\*Error:\*\*\s*/, '').replace(/^Error:\s*/, '')}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
              >
                <RiRefreshLine className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
          <span className="text-[10px] text-zinc-600 mt-1 block">{timeAgo}</span>
        </div>
      </div>
    );
  }

  // ── ASSISTANT MESSAGE ──
  return (
    <div className="flex gap-2.5 animate-fade-up" style={{ animationDuration: '0.3s' }}>
      {/* Avatar */}
      <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0 mt-0.5">
        <RiRobot2Line className="w-3.5 h-3.5 text-violet-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Thinking state */}
        {isEmpty && isLastAssistant && isStreaming && (
          <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-500">
            <RiLoader4Line className="w-3.5 h-3.5 animate-spin text-violet-400" />
            Thinking...
          </div>
        )}

        {!isEmpty && (
          <div className="prose prose-invert prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-code:text-violet-300 prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none text-sm text-zinc-300 leading-relaxed">
            <ReactMarkdown
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match && !String(children).includes('\n');

                  if (isInline) {
                    return (
                      <code className={cn("bg-white/[0.06] px-1.5 py-0.5 rounded-md text-violet-200 font-mono text-[13px]", className)} {...props}>
                        {children}
                      </code>
                    );
                  }

                  const codeText = String(children).replace(/\n$/, '');

                  return (
                    <div className="my-3 rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d0f]">
                      <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] text-[10px] text-zinc-500 uppercase tracking-wider font-medium flex items-center justify-between">
                        <span>{match ? match[1] : 'code'}</span>
                        <CopyButton text={codeText} />
                      </div>
                      <div className="overflow-x-auto p-3 text-[13px]">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </div>
                    </div>
                  );
                },
                a: ({ node, ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors underline decoration-violet-400/30 underline-offset-2" />
                ),
                ul: ({ node, ...props }) => (
                  <ul {...props} className="my-2 list-disc list-outside ml-4 space-y-1 text-zinc-300" />
                ),
                ol: ({ node, ...props }) => (
                  <ol {...props} className="my-2 list-decimal list-outside ml-4 space-y-1 text-zinc-300" />
                ),
                p: ({ node, ...props }) => (
                  <p {...props} className="mb-2 last:mb-0 leading-relaxed" />
                )
              }}
            >
              {displayText}
            </ReactMarkdown>

            {/* Streaming indicator */}
            {isLastAssistant && isStreaming && <StreamingDots />}
          </div>
        )}

        {/* Collapse toggle */}
        {isLong && !isStreaming && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="mt-1.5 flex items-center gap-1 text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors"
          >
            {isCollapsed ? (
              <><RiArrowDownSLine className="w-3 h-3" /> Show more</>
            ) : (
              <><RiArrowUpSLine className="w-3 h-3" /> Show less</>
            )}
          </button>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-zinc-600 mt-1 block">{timeAgo}</span>
      </div>
    </div>
  );
}