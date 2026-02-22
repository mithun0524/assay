'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { createStreamParser } from '@/lib/streamParser';
import { formatForDisplay } from '@/lib/displayFormatter';
import { writeFileToSandbox, runShellInSandbox, startDevServerInSandbox } from '@/lib/fileSystem';
import type { Message } from '@/lib/store';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';
import { buildFileContext } from '@/lib/contextBuilder';
import { routeToAgent, getAgent, getAgentReasoning, AgentContext } from '@/lib/agents';

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    css: 'css',
    md: 'markdown',
    txt: 'plaintext',
  };
  return langMap[ext || ''] || 'plaintext';
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
  const retryCountRef = useRef(0);
  const MAX_AUTO_RETRIES = 2;

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
    store.clearPreviewErrors();
    abortRef.current = new AbortController();

    // Reset retry counter on real user messages (not auto-retries)
    if (!userText.startsWith('The dev server encountered errors') && !userText.startsWith("I'm getting the following error")) {
      retryCountRef.current = 0;
    }

    // Snapshot current files before AI writes — enables undo
    store.takeSnapshot();

    let fullContent = '';
    const pendingShells: string[] = [];
    let pendingStart: string | null = null;
    let firstFileWritten = false;
    const collectedFileActions: Array<{ filePath: string; content: string }> = [];

    const parser = createStreamParser(async (action) => {
      if (action.type === 'file') {
        store.setActivelyWritingFile(action.filePath);
        store.setGenerationPhase('writing');

        // If diff preview is enabled, collect changes instead of writing immediately
        if (store.showDiffPreview) {
          collectedFileActions.push({ filePath: action.filePath, content: action.content });
        } else {
          await writeFileToSandbox(action.filePath, action.content);
        }

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

      // Build file context for AI awareness of existing project files
      const fileContext = buildFileContext(store.files);

      // Route to appropriate agent based on message and context
      const agentContext: AgentContext = {
        hasProject: store.hasProject,
        fileCount: Object.keys(store.files).length,
        hasErrors: store.previewErrors.length > 0,
        lastMessage: userText,
        hasImages: images.length > 0,
      };

      const agentRole = routeToAgent(userText, agentContext);
      const agent = getAgent(agentRole);
      const agentReasoning = getAgentReasoning(agentRole, agentContext);

      // Set active agent in store
      store.setActiveAgent(agentRole);

      // Use agent's system prompt combined with base prompt
      // If there's a project loaded, emphasize we're editing existing code
      const projectContext = store.hasProject
        ? '\n\nIMPORTANT: The user has a project loaded. They are asking you to MODIFY the existing code shown in <current_files>. Output the modified files immediately.\n\n'
        : '';
      const systemPrompt = SYSTEM_PROMPT + projectContext + '\n\n' + agent.systemPrompt;

      // Estimate base tokens (System + Context + History)
      const systemTokens = estimateTokens(systemPrompt) + estimateTokens(fileContext);
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
        body: JSON.stringify({
          messages: history,
          model: agent.model, // Use agent's preferred model
          apiKey: store.apiKey,
          fileContext,
          systemPrompt, // Pass custom system prompt
          temperature: agent.temperature, // Use agent's temperature
        }),
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
        store.updateLastAssistantMessage(fullContent, formatForDisplay(fullContent));

        // Update token usage with new content
        store.setTokenUsage(baseUsage + estimateTokens(fullContent));
      }

      parser.flush();

      // If diff preview is enabled, convert collected actions to pending changes
      if (store.showDiffPreview && collectedFileActions.length > 0) {
        const pendingChanges = collectedFileActions.map((action) => {
          const oldContent = store.files[action.filePath]?.content || null;
          const language = getLanguageFromPath(action.filePath);
          return {
            filePath: action.filePath,
            oldContent,
            newContent: action.content,
            language,
            status: 'pending' as const,
          };
        });
        store.setPendingChanges(pendingChanges);
        // Don't continue with shell commands and dev server - let user review first
        store.setIsStreaming(false);
        return;
      }

      // Run shell commands sequentially after all file writes
      if (pendingShells.length > 0) {
        store.setGenerationPhase('installing');
        store.setSandboxStatus('installing');
        for (const cmd of pendingShells) {
          await runShellInSandbox(cmd);
        }
      }

      // Start dev server last — always install dependencies first
      if (pendingStart !== null) {
        // Check if npm install was already run as a shell command
        const alreadyInstalled = pendingShells.some(
          (cmd) => /npm\s+install|npm\s+i\b|yarn\s+install|pnpm\s+install/.test(cmd)
        );
        if (!alreadyInstalled && firstFileWritten) {
          store.setGenerationPhase('installing');
          const { installDependencies } = await import('@/lib/fileSystem');
          await installDependencies();
        }
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

      // Auto-forward errors to AI (terminal + preview) with retry limit
      // Wait for terminal output to settle, then check for errors
      setTimeout(() => {
        const currentState = useStore.getState();
        const { terminalOutput, sandboxStatus, previewErrors, isStreaming: stillStreaming } = currentState;
        if (stillStreaming) return;
        if (retryCountRef.current >= MAX_AUTO_RETRIES) return;

        // Check terminal errors
        if (sandboxStatus === 'error' && terminalOutput) {
          const errors = extractTerminalErrors(terminalOutput);
          if (errors) {
            retryCountRef.current++;
            const errorMsg = `The dev server encountered errors (auto-retry ${retryCountRef.current}/${MAX_AUTO_RETRIES}). Please fix them:\n\n\`\`\`\n${errors}\n\`\`\``;
            submit(errorMsg);
            return;
          }
        }

        // Check preview iframe errors
        if (previewErrors.length > 0) {
          retryCountRef.current++;
          const errorText = previewErrors.join('\n');
          useStore.getState().clearPreviewErrors();
          const errorMsg = `I'm getting the following error(s) in my app preview (auto-retry ${retryCountRef.current}/${MAX_AUTO_RETRIES}). Please fix them:\n\n\`\`\`\n${errorText}\n\`\`\``;
          submit(errorMsg);
        }
      }, 3000);

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

  const submitComponentEdit = useCallback(
    async (
      filePath: string,
      selectionRange: { startLine: number; endLine: number },
      instruction: string
    ) => {
      // Get file content
      const fileContent = store.files[filePath]?.content;
      if (!fileContent) {
        console.error('File not found:', filePath);
        return;
      }

      // Extract component context
      const { extractComponentContext, buildComponentEditPrompt } = await import(
        '@/lib/componentExtractor'
      );
      const context = extractComponentContext(filePath, fileContent, selectionRange);

      // Build component edit prompt
      const componentPrompt = buildComponentEditPrompt(
        filePath,
        context.componentName,
        context.componentCode,
        context.imports,
        instruction
      );

      // Set component edit mode
      store.setComponentEditMode({
        active: true,
        filePath,
        componentName: context.componentName,
      });

      // Submit with component-specific prompt
      await submit(componentPrompt, []);

      // Clear component edit mode after submission
      setTimeout(() => {
        store.setComponentEditMode({ active: false, filePath: null, componentName: null });
      }, 100);
    },
    [store, submit]
  );

  return { submit, stop, submitComponentEdit };
}