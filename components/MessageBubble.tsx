'use client';

import { useMemo, useState, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css';
import { RiClipboardLine, RiCheckLine, RiRobot2Line, RiUser3Line, RiErrorWarningLine, RiLoader4Line, RiCodeSSlashLine, RiTerminalLine, RiPlayLine, RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import type { Message } from '@/lib/store';
import { toast } from 'sonner';

interface MessageBubbleProps {
  message: Message;
  isLastAssistant: boolean;
  isStreaming: boolean;
  onRetry?: () => void;
}

type ActionCardData = {
  files: string[];
  commands: string[];
  startCommand: string | null;
};

const ACTION_CARD_REGEX = /<!--ACTION_CARD:([\s\S]*?)-->/;
const CODE_PREVIEW_LINES = 6;
const USER_MESSAGE_MAX_LINES = 3;
const USER_MESSAGE_MAX_CHARS = 300;

// Hoisted to module level — prevents new array allocation on every render
const REHYPE_PLUGINS = [rehypeHighlight] as any;

function getLanguageFromExtension(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    kt: 'kotlin', swift: 'swift', css: 'css', scss: 'scss',
    html: 'html', json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', sql: 'sql', sh: 'bash', bash: 'bash',
    xml: 'xml', vue: 'html', svelte: 'html',
  };
  return map[ext] || ext || 'text';
}

function extractFileContent(rawContent: string, filePath: string): string {
  const escaped = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<boltAction\\s+type="file"\\s+filePath="${escaped}"\\s*>([\\s\\S]*?)(?:<\\/boltAction>|$)`
  );
  const match = rawContent.match(regex);
  return match ? match[1] : '';
}

function isFileActionComplete(rawContent: string, filePath: string): boolean {
  const escaped = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `<boltAction\\s+type="file"\\s+filePath="${escaped}"\\s*>[\\s\\S]*?<\\/boltAction>`
  );
  return regex.test(rawContent);
}

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
      <span className="w-2 h-2 rounded-full bg-violet-400 dot-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-2 h-2 rounded-full bg-violet-400 dot-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-2 h-2 rounded-full bg-violet-400 dot-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

const FileCard = memo(function FileCard({ filePath, rawContent, isFileGenerating }: {
  filePath: string;
  rawContent: string;
  isFileGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { openTab } = useStore();

  const content = useMemo(
    () => extractFileContent(rawContent, filePath),
    [rawContent, filePath]
  );
  const language = getLanguageFromExtension(filePath);
  const fileName = filePath.split('/').pop() || filePath;
  const lines = content.split('\n');
  const lineCount = lines.length;
  const needsTruncation = !expanded && lineCount > CODE_PREVIEW_LINES;
  const displayCode = needsTruncation
    ? lines.slice(0, CODE_PREVIEW_LINES).join('\n')
    : content;

  return (
    <div className="my-2 rounded-xl border border-white/[0.06] bg-[#0d0d0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/[0.06]">
        <RiCodeSSlashLine className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <button
          onClick={() => openTab(filePath)}
          className="text-xs font-medium text-zinc-300 hover:text-violet-300 transition-colors truncate font-mono"
          title={filePath}
        >
          {fileName}
        </button>
        {isFileGenerating ? (
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <RiLoader4Line className="w-3 h-3 animate-spin text-violet-400" />
            <span className="text-[10px] text-violet-400 font-medium">Generating...</span>
          </div>
        ) : (
          <>
            <span className="text-[10px] text-emerald-400/70 font-medium shrink-0">+{lineCount}</span>
            <div className="ml-auto shrink-0">
              <CopyButton text={content} />
            </div>
          </>
        )}
      </div>

      {/* Code preview */}
      {content && (
        <div className="relative overflow-hidden">
          <div className="overflow-x-auto p-3 text-[13px] leading-relaxed">
            <ReactMarkdown
              rehypePlugins={REHYPE_PLUGINS}
              components={{
                pre: ({ node, ...props }) => (
                  <pre {...props} className="!m-0 !p-0 !bg-transparent" />
                ),
                code: ({ node, className: codeClass, children, ...props }) => (
                  <code className={cn(codeClass, '!text-[13px] !leading-relaxed')} {...props}>
                    {children}
                  </code>
                ),
              }}
            >
              {`\`\`\`${language}\n${displayCode}\n\`\`\``}
            </ReactMarkdown>
          </div>

          {/* Fade overlay when truncated */}
          {needsTruncation && (
            <div className="h-10 -mt-10 relative bg-gradient-to-t from-[#0d0d0f] to-transparent pointer-events-none" />
          )}
        </div>
      )}

      {/* Expand / collapse */}
      {!isFileGenerating && lineCount > CODE_PREVIEW_LINES && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors border-t border-white/[0.04]"
        >
          {expanded ? (
            <><RiArrowUpSLine className="w-3.5 h-3.5" /> Collapse code block</>
          ) : (
            <><RiArrowDownSLine className="w-3.5 h-3.5" /> Show full code block</>
          )}
        </button>
      )}
    </div>
  );
});

function CommandCard({ command, icon }: { command: string; icon: React.ReactNode }) {
  return (
    <div className="my-1.5 flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
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
    <div className="group flex justify-end animate-fade-up min-w-0" style={{ animationDuration: '0.3s' }}>
      <div className="max-w-[85%] min-w-0 flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600">{timeAgo}</span>
          <div className="w-5 h-5 rounded-md bg-violet-500/20 flex items-center justify-center shrink-0">
            <RiUser3Line className="w-3 h-3 text-violet-400" />
          </div>
        </div>
        <div className="w-full rounded-2xl rounded-tr-md bg-violet-500/15 border border-violet-500/20 text-sm text-zinc-200 leading-relaxed overflow-hidden">
          <div
            className={cn(
              "px-3.5 py-2.5 whitespace-pre-wrap break-words overflow-wrap-anywhere",
              expanded && "max-h-[30vh] overflow-y-auto"
            )}
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {expanded || !isTooLong ? text : (
              <>
                {truncatedText}
                <span className="text-zinc-500">...</span>
              </>
            )}
          </div>
          {isTooLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-[11px] text-violet-400/70 hover:text-violet-300 transition-colors border-t border-violet-500/10 bg-violet-500/5"
            >
              {expanded ? (
                <><RiArrowUpSLine className="w-3.5 h-3.5" />Show less</>
              ) : (
                <><RiArrowDownSLine className="w-3.5 h-3.5" />Show more</>
              )}
            </button>
          )}
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={text} />
        </div>
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
              <code className={cn("bg-white/[0.06] px-1.5 py-0.5 rounded-md text-violet-200 font-mono text-[13px]", className)} {...props}>
                {children}
              </code>
            );
          }

          const codeText = String(children).replace(/\n$/, '');

          return (
            <div className="my-3 rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d0f]">
              <div className="px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
                <span className="px-1.5 py-0.5 text-[10px] font-medium text-violet-300 bg-violet-500/10 rounded">{match ? match[1] : 'code'}</span>
                <CopyButton text={codeText} />
              </div>
              <div className="overflow-x-auto p-3 text-[13px]">
                <code className={className} {...props}>{children}</code>
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

  // -- USER MESSAGE --
  if (isUser) {
    return <UserMessageBubble message={message} timeAgo={timeAgo} />;
  }

  // -- ERROR MESSAGE --
  if (isError) {
    return (
      <div className="group flex gap-2.5 animate-fade-up" style={{ animationDuration: '0.3s' }}>
        <div className="w-6 h-6 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
          <RiErrorWarningLine className="w-3.5 h-3.5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="px-3.5 py-3 rounded-2xl rounded-tl-md bg-red-500/[0.08] border border-red-500/20">
            <p className="text-sm text-red-300/90 leading-relaxed">{message.displayContent.replace(/^\u274C\s*\*\*Error:\*\*\s*/, '').replace(/^Error:\s*/, '')}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-zinc-600">{timeAgo}</span>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <CopyButton text={message.displayContent} />
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-all"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -- ASSISTANT MESSAGE --
  return (
    <div className="group flex gap-2.5 animate-fade-up" style={{ animationDuration: '0.3s' }}>
      <div className={cn(
        "w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0 mt-0.5 transition-all",
        isLastAssistant && isStreaming && "ring-2 ring-violet-500/30 shadow-[0_0_8px_rgba(124,58,237,0.3)]"
      )}>
        <RiRobot2Line className="w-3.5 h-3.5 text-violet-400" />
      </div>

      <div className="flex-1 min-w-0">
        {isEmpty && isLastAssistant && isStreaming && (
          <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-500">
            <RiLoader4Line className="w-3.5 h-3.5 animate-spin text-violet-400" />
            Thinking...
          </div>
        )}

        {!isEmpty && (
          <div className="prose prose-invert prose-sm max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-code:text-violet-300 prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none text-sm text-zinc-300 leading-relaxed">
            {segments.map((seg, i) => {
              if (seg.type === 'text') {
                return <MarkdownBlock key={i} content={seg.content} />;
              }
              return (
                <div key={i}>
                  {seg.data.files.map((filePath) => (
                    <FileCard
                      key={filePath}
                      filePath={filePath}
                      rawContent={message.content}
                      isFileGenerating={isActiveStreaming && !isFileActionComplete(message.content, filePath)}
                    />
                  ))}
                  {seg.data.commands.map((cmd, j) => (
                    <CommandCard
                      key={`cmd-${j}`}
                      command={cmd}
                      icon={<RiTerminalLine className="w-3 h-3 text-zinc-500 shrink-0" />}
                    />
                  ))}
                  {seg.data.startCommand && (
                    <CommandCard
                      command={seg.data.startCommand}
                      icon={<RiPlayLine className="w-3 h-3 text-emerald-500 shrink-0" />}
                    />
                  )}
                </div>
              );
            })}

            {isActiveStreaming && !hasActionCard && <StreamingDots />}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-zinc-600">{timeAgo}</span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <CopyButton text={message.displayContent} />
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
