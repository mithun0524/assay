'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { createStreamParser, stripActions } from '@/lib/streamParser';
import { writeFileToSandbox, runShellInSandbox, startDevServerInSandbox } from '@/lib/fileSystem';
import type { Message } from '@/lib/store';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

// Common terminal error patterns
const ERROR_PATTERNS = [
  /error\s*TS\d+:/i,
  /SyntaxError:/,
  /Cannot find module/,
  /Module not found/,
  /TypeError:/,
  /ReferenceError:/,
  /ENOENT/,
  /Failed to resolve/,
  /ERROR\s+in\s+/,
  /✘\s+\[ERROR\]/,
];

function extractTerminalErrors(output: string): string | null {
  const lines = output.split('\n');
  const errorLines: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const isError = ERROR_PATTERNS.some(p => p.test(line));
    if (isError) {
      capturing = true;
      errorLines.push(line.trim());
    } else if (capturing) {
      // Capture a few context lines after an error
      if (line.trim() && errorLines.length < 20) {
        errorLines.push(line.trim());
      } else {
        capturing = false;
      }
    }
  }

  if (errorLines.length === 0) return null;
  return errorLines.join('\n');
}

export function useChat() {
  const store = useStore();
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(async (userText: string, images: string[] = []) => {
    if ((!userText.trim() && images.length === 0) || store.isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      images,
      displayContent: userText,
      timestamp: Date.now(),
    };
    store.addMessage(userMsg);

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      displayContent: '',
      timestamp: Date.now(),
    };
    store.addMessage(assistantMsg);
    store.setIsStreaming(true);
    store.setGenerationPhase('writing');
    abortRef.current = new AbortController();

    let fullContent = '';
    const pendingShells: string[] = [];
    let pendingStart: string | null = null;
    let firstFileWritten = false;

    const parser = createStreamParser(async (action) => {
      if (action.type === 'file') {
        store.setActivelyWritingFile(action.filePath);
        store.setGenerationPhase('writing');
        await writeFileToSandbox(action.filePath, action.content);
        store.setActivelyWritingFile(null);

        // On first file, signal that we have a project
        if (!firstFileWritten) {
          firstFileWritten = true;
          store.setHasProject(true);
        }
      } else if (action.type === 'shell') {
        pendingShells.push(action.command);
      } else if (action.type === 'start') {
        pendingStart = action.command;
      }
    });

    try {
      // Build conversation history (omit empty assistant placeholders)
      const history = [...store.messages, userMsg]
        .filter((m) => m.content.trim() !== '' || (m.images && m.images.length > 0))
        .map((m) => {
          if (m.images && m.images.length > 0) {
            return {
              role: m.role,
              content: [
                { type: 'text', text: m.content },
                ...m.images.map((img) => ({ type: 'image_url', image_url: { url: img } })),
              ],
            };
          }
          return { role: m.role, content: m.content };
        });

      // Estimate base tokens (System + History)
      const systemTokens = estimateTokens(SYSTEM_PROMPT);
      const historyTokens = history.reduce((acc, m) => {
        let contentTokens = 0;
        if (Array.isArray(m.content)) {
          contentTokens = m.content.reduce((subAcc: number, item: any) => {
            if (item.type === 'text') return subAcc + estimateTokens(item.text);
            if (item.type === 'image_url') return subAcc + 1000;
            return subAcc;
          }, 0);
        } else {
          contentTokens = estimateTokens(String(m.content));
        }
        return acc + contentTokens;
      }, 0);
      let baseUsage = systemTokens + historyTokens;
      store.setTokenUsage(baseUsage);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, model: store.selectedModel, apiKey: store.apiKey }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('retry-after') || '60', 10);
          store.setRateLimitUntil(Date.now() + retryAfter * 1000);
          throw new Error(`Rate limited. Please wait ${retryAfter} seconds before trying again.`);
        }
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        parser.feed(chunk);
        store.updateLastAssistantMessage(fullContent, stripActions(fullContent));

        // Update token usage with new content
        store.setTokenUsage(baseUsage + estimateTokens(fullContent));
      }

      parser.flush();

      // Run shell commands sequentially after all file writes
      if (pendingShells.length > 0) {
        store.setGenerationPhase('installing');
        store.setSandboxStatus('installing');
        for (const cmd of pendingShells) {
          await runShellInSandbox(cmd);
        }
      }

      // Start dev server last
      if (pendingStart !== null) {
        store.setGenerationPhase('starting');
        await startDevServerInSandbox();
      }

      store.setGenerationPhase('done');

      // After a brief moment, reset to idle
      setTimeout(() => store.setGenerationPhase('idle'), 3000);

      // Persist to IndexedDB
      let projectId = store.currentProjectId;
      if (!projectId) {
        const { createNewProject } = await import('@/lib/db');
        projectId = await createNewProject(userText.slice(0, 30) || 'Untitled Project');
        store.setCurrentProjectId(projectId);
        store.setHasProject(true);
      }

      if (projectId) {
        const { saveProject } = await import('@/lib/db');
        await saveProject(projectId, useStore.getState().files, useStore.getState().messages).catch(console.error);
      }

      // Phase 3: Auto-forward terminal errors to chat
      // Wait a moment for terminal output to settle, then check for errors
      setTimeout(() => {
        const terminalOutput = useStore.getState().terminalOutput;
        const sandboxStatus = useStore.getState().sandboxStatus;
        if (sandboxStatus === 'error' && terminalOutput) {
          const errors = extractTerminalErrors(terminalOutput);
          if (errors) {
            // Auto-submit errors as a follow-up
            const errorMsg = `The dev server encountered errors. Please fix them:\n\n\`\`\`\n${errors}\n\`\`\``;
            // Only auto-forward if not already streaming
            if (!useStore.getState().isStreaming) {
              submit(errorMsg);
            }
          }
        }
      }, 2000);

    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        const msg = (err as Error).message;
        store.updateLastAssistantMessage(
          `Error: ${msg}`,
          `❌ **Error:** ${msg}\n\nPlease check your OpenRouter API key and try again.`
        );
        store.setSandboxStatus('error');
      }
      store.setGenerationPhase('idle');
    } finally {
      store.setIsStreaming(false);
      store.setActivelyWritingFile(null);
    }
  }, [store]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    store.setIsStreaming(false);
    store.setGenerationPhase('idle');
    store.setActivelyWritingFile(null);
  }, [store]);

  return { submit, stop };
}