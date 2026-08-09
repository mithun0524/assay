'use client';

import { useMemo, useState, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import { RiClipboardLine, RiCheckLine, RiErrorWarningLine, RiLoader4Line, RiArrowDownSLine, RiArrowUpSLine, RiEyeLine, RiDeleteBin6Line, RiGlobalLine } from '@remixicon/react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/store';
import { AGENTS } from '@/lib/agents';
import type { AgentRole } from '@/lib/agents';
import { toast } from 'sonner';

const SYSTEM_ROW: Record<'qa' | 'inspect' | 'search', { label: string; tone: string; icon: React.ReactNode }> = {
  qa: {
    label: 'QA agent sent the failures back to the debugger',
    tone: 'border-white/[0.08] bg-white/[0.04] text-zinc-300',
    icon: <RiLoader4Line className="w-3 h-3 text-zinc-400 shrink-0" />,
  },
  inspect: {
    label: 'Sandbox answered the agent',
    tone: 'border-white/[0.08] bg-white/[0.04] text-zinc-300',
    icon: <RiEyeLine className="w-3 h-3 text-zinc-400 shrink-0" />,
  },
  search: {
    label: 'Web results handed to the agent',
    tone: 'border-sky-500/20 bg-sky-500/[0.04] text-sky-300/90',
    icon: <RiGlobalLine className="w-3 h-3 text-sky-400 shrink-0" />,
  },
};

/**
 * Turns the client injects on the agent's behalf. They are machine chatter, not
 * something the user typed, so they get a quiet collapsed row of their own.
 */
function SystemRow({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const spec = SYSTEM_ROW[message.kind as 'qa' | 'inspect' | 'search'];
  const attempt = message.content.match(/attempt (\d+\/\d+)/)?.[1];

  return (
    <div className={cn('rounded-lg border', spec.tone)}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
      >
        {spec.icon}
        <span className="font-mono text-[10px] tracking-wide truncate">
          {spec.label}{attempt ? ` · ${attempt}` : ''}
        </span>
        <span className="ml-auto font-mono text-[10px] text-zinc-500 shrink-0">
          {expanded ? 'Hide' : 'Details'}
        </span>
      </button>
      {expanded && (
        <pre className="px-2.5 pb-2 text-[11px] leading-relaxed text-zinc-400 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
          {message.content}
        </pre>
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isLastAssistant: boolean;
  isStreaming: boolean;
  onRetry?: () => void;
}

type ActionCardData = {
  reads?: string[];
  lists?: string[];
  deletes?: string[];
  files: string[];
  commands: string[];
  startCommand: string | null;
};

/** Tailwind can't build class names at runtime — map roles to static rail classes. */
const AGENT_RAIL: Record<AgentRole, string> = {
  architect: 'border-blue-400/70',
  assistant: 'border-cyan-400/70',
  coder: 'border-green-400/70',
  debugger: 'border-rose-400/70',
  designer: 'border-purple-400/70',
  tester: 'border-amber-400/70',
};

const ACTION_CARD_REGEX = /<!--ACTION_CARD:([\s\S]*?)-->/;
const USER_MESSAGE_MAX_LINES = 3;
const USER_MESSAGE_MAX_CHARS = 300;

// Hoisted to module level — prevents new array allocation on every render
const REHYPE_PLUGINS = [rehypeHighlight] as any;

/* getLanguageFromExtension, extractFileContent and isFileActionComplete lived
   here to parse and highlight the inline code blocks. Nothing renders code in
   the chat any more, so all three went with it. */

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
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-all",
        copied
          ? "bg-emerald-500/15 text-emerald-400"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
      )}
    >
      {copied ? (
        <><RiCheckLine className="w-3 h-3 text-emerald-400" /><span>Copied</span></>
      ) : (
        <><RiClipboardLine className="w-3 h-3" /><span>Copy</span></>
      )}
    </button>
  );
}

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1.5 ml-1">
      <span className="w-2 h-2 rounded-full bg-zinc-400 dot-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-zinc-400 dot-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 rounded-full bg-zinc-400 dot-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

/* A FileCard component lived here: one row per file the agent touched, and
   before that the file's full contents inline. Both are gone. The chat narrates
   and the live status line names the file being written; the file tree, editor
   and terminal hold the record. See docs/mockups/chat.html, direction C. */


function CommandCard({ command, icon }: { command: string; icon: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
      {icon}
      <span className="text-[11px] text-zinc-400 font-mono truncate">{command}</span>
    </div>
  );
}

function UserMessageBubble({ message, timeAgo }: { message: Message; timeAgo: string }) {
  const [expanded, setExpanded] = useState(false);
  const text = message.displayContent;
  const lines = text.split('\n');
  const isTooLong = lines.length > USER_MESSAGE_MAX_LINES || text.length > USER_MESSAGE_MAX_CHARS;

  const truncatedText = useMemo(() => {
    if (!isTooLong) return text;
    // Take first N lines, then cap at max chars
    let preview = lines.slice(0, USER_MESSAGE_MAX_LINES).join('\n');
    if (preview.length > USER_MESSAGE_MAX_CHARS) {
      preview = preview.slice(0, USER_MESSAGE_MAX_CHARS);
    }
    return preview;
  }, [text, lines, isTooLong]);

  return (
    <div className="group animate-fade-up min-w-0" style={{ animationDuration: '0.25s' }}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">You</span>
        <span className="font-mono text-[10px] text-zinc-700">{timeAgo}</span>
        <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={text} />
        </span>
      </div>
      <div className="border-l-2 border-zinc-700 pl-3 min-w-0">
        <div
          className={cn(
            'text-[13.5px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words',
            expanded && 'max-h-[30vh] overflow-y-auto'
          )}
          style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
        >
          {expanded || !isTooLong ? text : (
            <>
              {truncatedText}
              <span className="text-zinc-600">…</span>
            </>
          )}
        </div>
        {isTooLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? (
              <><RiArrowUpSLine className="w-3.5 h-3.5" />Show less</>
            ) : (
              <><RiArrowDownSLine className="w-3.5 h-3.5" />Show more</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

const MarkdownBlock = memo(function MarkdownBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={REHYPE_PLUGINS}
      components={{
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match && !String(children).includes('\n');

          if (isInline) {
            return (
              <code className={cn("bg-white/[0.06] px-1.5 py-0.5 rounded-md text-zinc-200 font-mono text-[13px]", className)} {...props}>
                {children}
              </code>
            );
          }

          const codeText = String(children).replace(/\n$/, '');

          return (
            <div className="my-3 rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d0f]">
              <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
                <span className="px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 bg-white/[0.04] border border-white/[0.08] rounded">{match ? match[1] : 'code'}</span>
                <CopyButton text={codeText} />
              </div>
              <div className="overflow-x-auto p-3 text-[13px]">
                <code className={className} {...props}>{children}</code>
              </div>
            </div>
          );
        },
        a: ({ node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" className="text-zinc-100 hover:text-white transition-colors underline decoration-white/30 underline-offset-2" />
        ),
        ul: ({ node, ...props }) => (
          <ul {...props} className="my-2 list-disc list-outside ml-4 space-y-1 text-zinc-300" />
        ),
        ol: ({ node, ...props }) => (
          <ol {...props} className="my-2 list-decimal list-outside ml-4 space-y-1 text-zinc-300" />
        ),
        p: ({ node, ...props }) => (
          <p {...props} className="mb-2 last:mb-0 leading-relaxed" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

export const MessageBubble = memo(function MessageBubble({ message, isLastAssistant, isStreaming, onRetry }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isError = message.displayContent.startsWith('\u274C') || message.content.startsWith('Error:');
  const isEmpty = !message.displayContent.trim();

  const timeAgo = useMemo(() => relativeTime(message.timestamp), [message.timestamp]);

  const hasActionCard = ACTION_CARD_REGEX.test(message.displayContent);
  const isActiveStreaming = isLastAssistant && isStreaming;

  // Split display content into text segments and action cards
  const segments = useMemo(() => {
    const content = message.displayContent;
    const match = content.match(ACTION_CARD_REGEX);

    if (!match) {
      return [{ type: 'text' as const, content }];
    }

    const parts: Array<{ type: 'text'; content: string } | { type: 'card'; data: ActionCardData }> = [];
    const idx = match.index!;

    const before = content.substring(0, idx).trim();
    if (before) parts.push({ type: 'text', content: before });

    try {
      const data = JSON.parse(match[1]) as ActionCardData;
      parts.push({ type: 'card', data });
    } catch {
      // If JSON parse fails, skip the card
    }

    const after = content.substring(idx + match[0].length).trim();
    if (after) parts.push({ type: 'text', content: after });

    return parts;
  }, [message.displayContent]);

  // -- QA GATE MESSAGE --
  // Automatic fix requests are machine chatter, not something the user typed.
  // Show them as a quiet system line instead of a wall of stack traces.
  if (isUser && message.kind) {
    return <SystemRow message={message} />;
  }

  // -- USER MESSAGE --
  if (isUser) {
    return <UserMessageBubble message={message} timeAgo={timeAgo} />;
  }

  // -- ERROR MESSAGE --
  // Same rail language as an agent turn: what happened on the first line,
  // what to do about it on the second.
  if (isError) {
    const body = message.displayContent
      .replace(/^\u274C\s*\*\*Error:\*\*\s*/, '')
      .replace(/^Error:\s*/, '')
      .replace(/\*\*/g, '');
    const [headline, ...rest] = body.split('\n').filter((l) => l.trim());

    return (
      <div className="group animate-fade-up min-w-0" style={{ animationDuration: '0.25s' }}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-red-400 flex items-center gap-1.5">
            <RiErrorWarningLine className="w-3 h-3" />
            Failed
          </span>
          <span className="font-mono text-[10px] text-zinc-700">{timeAgo}</span>
          <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <CopyButton text={message.displayContent} />
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] rounded transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </span>
        </div>
        <div className="border-l-2 border-red-500/50 pl-3 min-w-0">
          <p className="text-[13.5px] text-red-200/90 leading-relaxed break-words">{headline}</p>
          {rest.length > 0 && (
            <p className="mt-1 text-[12.5px] text-zinc-400 leading-relaxed break-words">{rest.join(' ')}</p>
          )}
        </div>
      </div>
    );
  }

  // -- ASSISTANT MESSAGE --
  // The rail is the signature of this transcript: a rule down the left of every
  // agent turn, coloured by the specialist that produced it, so you can scan the
  // history and see who did what without reading a word.
  const agent = message.agent ? AGENTS[message.agent] : null;
  const isLive = isLastAssistant && isStreaming;

  return (
    <div className="group animate-fade-up min-w-0" style={{ animationDuration: '0.25s' }}>
      <div className="flex items-baseline gap-2 mb-1">
        <span
          className={cn(
            'font-mono text-[10px] uppercase tracking-[0.14em]',
            agent ? agent.color : 'text-zinc-500'
          )}
        >
          {agent ? agent.name : 'Agent'}
        </span>
        {isLive && (
          <span className="font-mono text-[10px] text-zinc-600 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
            working
          </span>
        )}
        <span className="font-mono text-[10px] text-zinc-700">{timeAgo}</span>
      </div>

      <div
        className={cn(
          'border-l-2 pl-3 min-w-0 transition-colors',
          agent ? AGENT_RAIL[agent.role] : 'border-zinc-800',
          isLive && 'border-opacity-100'
        )}
      >
        {isEmpty && isLastAssistant && isStreaming && (
          <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-500">
            <RiLoader4Line className="w-3.5 h-3.5 animate-spin text-zinc-400" />
            Thinking...
          </div>
        )}

        {!isEmpty && (
          <div className="prose prose-invert prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-code:text-zinc-200 prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none text-sm text-zinc-300 leading-relaxed [&>*:last-child]:mb-0 [&>*:last-child>*:last-child]:mb-0">
            {segments.map((seg, i) => {
              if (seg.type === 'text') {
                return <MarkdownBlock key={i} content={seg.content} />;
              }
              /* The chat narrates; it does not enumerate.
               *
               * Files written, shell commands, reads and directory listings all
               * used to render as a stack of cards here. They are the agent's
               * bookkeeping, not the conversation — the file tree, the editor
               * and the terminal already hold every one of them, and the live
               * status line below the transcript names the file being written
               * as it happens. Listing them a fourth time turned a two-sentence
               * answer into a scroll.
               *
               * Deletions are the exception and stay. Everything else that
               * disappears from this list is still visible somewhere else in
               * the workspace; a deleted file is not, so silently dropping it
               * would be the one case where the user loses information. */
              const deletes = seg.data.deletes ?? [];
              if (deletes.length === 0) return null;
              return (
                <div key={i}>
                  {deletes.map((filePath, j) => (
                    <CommandCard
                      key={`del-${j}`}
                      command={`Deleted ${filePath}`}
                      icon={<RiDeleteBin6Line className="w-3 h-3 text-rose-400 shrink-0" />}
                    />
                  ))}
                </div>
              );
            })}

            {isActiveStreaming && !hasActionCard && <StreamingDots />}
          </div>
        )}

      </div>

      {/* Outside the rail — an invisible hover row inside it left the rule
          hanging ~25px below the last card. */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1 pl-[14px]">
        <CopyButton text={message.displayContent} />
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] rounded transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
});
