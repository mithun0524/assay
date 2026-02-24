'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { createStreamParser } from '@/lib/streamParser';
import { formatForDisplay } from '@/lib/displayFormatter';
import { writeFileToSandbox, runShellInSandbox, startDevServerInSandbox } from '@/lib/fileSystem';
import type { Message } from '@/lib/store';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';
import { buildFileContext } from '@/lib/contextBuilder';
import { routeToAgent, getAgent, getAgentReasoning, AgentContext, classifyWithLLM } from '@/lib/agents';
import type { AgentRole } from '@/lib/agents';
import { stripAnsi, detectTerminalErrors } from '@/lib/terminalErrorDetector';

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


function extractTerminalErrors(output: string): string | null {
  const errors = detectTerminalErrors(stripAnsi(output));
  return errors ? errors.join('\n') : null;
}

export function useChat() {
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const searchRetryRef = useRef(0);
  const submitRef = useRef<((text: string, images?: string[]) => Promise<void>) | null>(null);
  const MAX_AUTO_RETRIES = 2;
  const MAX_SEARCH_RETRIES = 2;

  // Read store actions/state on demand — no reactive subscription
  const gs = useStore.getState;

  const submit = useCallback(async (userText: string, images: string[] = []) => {
    if ((!userText.trim() && images.length === 0) || gs().isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      images,
      displayContent: userText,
      timestamp: Date.now(),
    };
    gs().addMessage(userMsg);
    gs().clearTerminalErrors();

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      displayContent: '',
      timestamp: Date.now(),
    };
    gs().addMessage(assistantMsg);
    gs().setIsStreaming(true);
    gs().setGenerationPhase('writing');
    gs().clearPreviewErrors();
    abortRef.current = new AbortController();

    // Reset retry counter on real user messages (not auto-retries)
    if (
      !userText.startsWith('The dev server encountered errors') &&
      !userText.startsWith("I'm getting the following error") &&
      !userText.startsWith('Here are the web search results you requested')
    ) {
      retryCountRef.current = 0;
      searchRetryRef.current = 0;
    }

    // Snapshot current files before AI writes — enables undo
    gs().takeSnapshot();

    let fullContent = '';
    const pendingShells: string[] = [];
    const pendingSearches: string[] = [];
    let pendingStart: string | null = null;
    let firstFileWritten = false;
    const collectedFileActions: Array<{ filePath: string; content: string }> = [];

    const parser = createStreamParser(async (action) => {
      if (action.type === 'file') {
        gs().setActivelyWritingFile(action.filePath);
        gs().setGenerationPhase('writing');

        // If diff preview is enabled, collect changes instead of writing immediately
        if (gs().showDiffPreview) {
          collectedFileActions.push({ filePath: action.filePath, content: action.content });
        } else {
          await writeFileToSandbox(action.filePath, action.content);
        }

        gs().setActivelyWritingFile(null);

        // On first file, signal that we have a project
        if (!firstFileWritten) {
          firstFileWritten = true;
          gs().setHasProject(true);
        }
      } else if (action.type === 'shell') {
        pendingShells.push(action.command);
      } else if (action.type === 'start') {
        pendingStart = action.command;
      } else if (action.type === 'search') {
        pendingSearches.push(action.query);
      }
    });

    try {
      // User-triggered web search: prepend results to the user message
      let searchPrefix = '';
      if (gs().webSearchEnabled && userText.trim() && !userText.startsWith('Here are the web search results you requested')) {
        try {
          gs().setIsSearching(true);
          gs().setGenerationPhase('searching');
          const { executeSearch, formatSearchResults } = await import('@/lib/searchClient');
          const searchData = await executeSearch(userText);
          searchPrefix = formatSearchResults(searchData) + '\n\n';
          gs().setLastSearchResults(searchPrefix);
        } catch (e) {
          console.warn('User-triggered search failed, continuing without results:', e);
        } finally {
          gs().setIsSearching(false);
          gs().setGenerationPhase('writing');
        }
      }

      // Build conversation history (omit empty assistant placeholders)
      const history = [...gs().messages, userMsg]
        .filter((m) => m.content.trim() !== '' || (m.images && m.images.length > 0))
        .map((m) => {
          // Prepend search results to the last user message
          const isLastUser = m.id === userMsg.id;
          const content = isLastUser && searchPrefix ? searchPrefix + m.content : m.content;

          if (m.images && m.images.length > 0) {
            return {
              role: m.role,
              content: [
                { type: 'text', text: content },
                ...m.images.map((img) => ({ type: 'image_url', image_url: { url: img } })),
              ],
            };
          }
          return { role: m.role, content };
        });

      // Build file context for AI awareness of existing project files
      const fileContext = buildFileContext(gs().files);

      // Route to appropriate agent based on message and context
      const agentContext: AgentContext = {
        hasProject: gs().hasProject,
        fileCount: Object.keys(gs().files).length,
        hasErrors: gs().previewErrors.length > 0,
        lastMessage: userText,
        hasImages: images.length > 0,
      };

      // LLM-based classification with regex fallback
      let agentRole: AgentRole;
      let agentModel: string | undefined;
      const classification = await classifyWithLLM(userText, agentContext, gs().apiKey);
      if (classification) {
        agentRole = classification.role;
        agentModel = classification.model;
      } else {
        agentRole = routeToAgent(userText, agentContext);
        agentModel = undefined;
      }
      const agent = getAgent(agentRole);
      const agentReasoning = classification?.reasoning || getAgentReasoning(agentRole, agentContext);

      // Set active agent in store
      gs().setActiveAgent(agentRole);

      // Use agent's system prompt combined with base prompt
      // If there's a project loaded, emphasize we're editing existing code
      const projectContext = gs().hasProject
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
      gs().setTokenUsage(baseUsage);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          model: agentModel || agent.model, // LLM-picked model or agent default
          apiKey: gs().apiKey,
          fileContext,
          systemPrompt, // Pass custom system prompt
          temperature: agent.temperature, // Use agent's temperature
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('retry-after') || '60', 10);
          gs().setRateLimitUntil(Date.now() + retryAfter * 1000);
          throw new Error(`Rate limited. Please wait ${retryAfter} seconds before trying again.`);
        }
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // ── Throttled streaming update loop ──
      // formatForDisplay runs 6+ regex passes — throttle to once per animation frame
      let displayRafId: number | null = null;
      let tokenTimer: ReturnType<typeof setTimeout> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        parser.feed(chunk);

        // Throttle display updates to ~1 per animation frame (~16ms)
        if (displayRafId === null) {
          displayRafId = requestAnimationFrame(() => {
            displayRafId = null;
            gs().updateLastAssistantMessage(fullContent, formatForDisplay(fullContent));
          });
        }

        // Throttle token usage updates to every 500ms
        if (!tokenTimer) {
          tokenTimer = setTimeout(() => {
            tokenTimer = null;
            gs().setTokenUsage(baseUsage + estimateTokens(fullContent));
          }, 500);
        }
      }

      // Flush any pending throttled updates
      if (displayRafId !== null) cancelAnimationFrame(displayRafId);
      if (tokenTimer) clearTimeout(tokenTimer);
      // Final update with complete content
      gs().updateLastAssistantMessage(fullContent, formatForDisplay(fullContent));
      gs().setTokenUsage(baseUsage + estimateTokens(fullContent));

      parser.flush();

      // AI-requested search: execute pending searches and auto-continue
      if (pendingSearches.length > 0 && searchRetryRef.current < MAX_SEARCH_RETRIES) {
        searchRetryRef.current++;
        gs().setGenerationPhase('searching');
        gs().setIsSearching(true);
        try {
          const { executeSearch, formatSearchResults } = await import('@/lib/searchClient');
          const queries = pendingSearches.slice(0, 2); // Cap at 2 searches
          const results: string[] = [];
          for (const query of queries) {
            try {
              const data = await executeSearch(query);
              results.push(formatSearchResults(data));
            } catch (e) {
              console.warn(`AI-requested search failed for "${query}":`, e);
            }
          }
          if (results.length > 0) {
            const searchResultsMsg = `Here are the web search results you requested:\n\n${results.join('\n\n')}\n\nPlease continue with the task using this information.`;
            gs().setIsSearching(false);
            gs().setIsStreaming(false);
            submitRef.current?.(searchResultsMsg);
            return;
          }
        } catch (e) {
          console.warn('AI-requested search failed:', e);
        } finally {
          gs().setIsSearching(false);
        }
      }

      // If diff preview is enabled, convert collected actions to pending changes
      if (gs().showDiffPreview && collectedFileActions.length > 0) {
        const currentFiles = gs().files;
        const pendingChanges = collectedFileActions.map((action) => {
          const oldContent = currentFiles[action.filePath]?.content || null;
          const language = getLanguageFromPath(action.filePath);
          return {
            filePath: action.filePath,
            oldContent,
            newContent: action.content,
            language,
            status: 'pending' as const,
          };
        });
        gs().setPendingChanges(pendingChanges);
        // Don't continue with shell commands and dev server - let user review first
        gs().setIsStreaming(false);
        return;
      }

      // Run shell commands sequentially after all file writes.
      // Dev-server-like commands (npm run dev, npm start, vite, etc.) are
      // long-running and never exit, so route them through startDevServerInSandbox
      // instead of runShellInSandbox which awaits process.exit.
      const DEV_SERVER_RE = /^(npm\s+(run\s+dev|start)|yarn\s+(dev|start)|pnpm\s+(dev|start)|npx\s+vite|vite)\b/;
      const INSTALL_CMD_RE = /^(npm\s+(install|i|ci)\b|yarn(\s+install)?\b|pnpm\s+(install|i)\b)/;
      let shellTriggeredServer = false;

      if (pendingShells.length > 0) {
        const hasInstallCmd = pendingShells.some((cmd) => INSTALL_CMD_RE.test(cmd.trim()));
        const prevSandboxStatus = gs().sandboxStatus;
        const wasServerRunning = prevSandboxStatus === 'ready' || !!gs().previewUrl;

        // Stop dev server before running shell commands (like Ctrl+C)
        if (wasServerRunning) {
          const { stopDevServer } = await import('@/lib/fileSystem');
          await stopDevServer();
        }

        gs().setGenerationPhase('installing');
        if (hasInstallCmd) {
          gs().setSandboxStatus('installing');
        }
        for (const cmd of pendingShells) {
          if (DEV_SERVER_RE.test(cmd.trim())) {
            // Will be handled as a server start below
            shellTriggeredServer = true;
          } else {
            await runShellInSandbox(cmd);
          }
        }

        // If an install command ran but no dev server start follows,
        // automatically restart the dev server if one was previously running.
        if (hasInstallCmd && !shellTriggeredServer && pendingStart === null) {
          if (wasServerRunning) {
            shellTriggeredServer = true;
          } else {
            const currentStatus = gs().sandboxStatus;
            if (currentStatus === 'installing' || currentStatus === 'starting') {
              gs().setSandboxStatus('idle');
            }
          }
        } else if (!shellTriggeredServer && pendingStart === null) {
          // If server was running before shell commands, restart it
          if (wasServerRunning) {
            shellTriggeredServer = true;
          } else {
            // Restore sandboxStatus if no dev server start follows and status is still transitional
            const currentStatus = gs().sandboxStatus;
            if (currentStatus === 'installing' || currentStatus === 'starting') {
              gs().setSandboxStatus('idle');
            }
          }
        }
      }

      // Start dev server last — always install dependencies first
      if (pendingStart !== null || shellTriggeredServer) {
        // Check if npm install was already run as a shell command
        const alreadyInstalled = pendingShells.some(
          (cmd) => /npm\s+install|npm\s+i\b|yarn\s+install|pnpm\s+install/.test(cmd)
        );
        if (!alreadyInstalled && firstFileWritten) {
          gs().setGenerationPhase('installing');
          const { installDependencies } = await import('@/lib/fileSystem');
          await installDependencies();
        }
        gs().setGenerationPhase('starting');
        await startDevServerInSandbox();
      }

      gs().setGenerationPhase('done');

      // After a brief moment, reset to idle
      setTimeout(() => gs().setGenerationPhase('idle'), 3000);

      // Persist to IndexedDB
      let projectId = gs().currentProjectId;
      if (!projectId) {
        const { createNewProject } = await import('@/lib/db');
        projectId = await createNewProject(userText.slice(0, 30) || 'Untitled Project');
        gs().setCurrentProjectId(projectId);
        gs().setHasProject(true);
      }

      if (projectId) {
        const { saveProject } = await import('@/lib/db');
        await saveProject(projectId, gs().files, gs().messages).catch(console.error);
      }

      // Auto-forward errors to AI (terminal + preview) with retry limit
      // Wait for terminal output to settle, then check for errors
      setTimeout(() => {
        const currentState = gs();
        const { terminalOutput, sandboxStatus, previewErrors, isStreaming: stillStreaming } = currentState;
        if (stillStreaming) return;
        if (retryCountRef.current >= MAX_AUTO_RETRIES) return;

        // Check terminal errors
        if (sandboxStatus === 'error' && terminalOutput) {
          const errors = extractTerminalErrors(terminalOutput);
          if (errors) {
            retryCountRef.current++;
            const errorMsg = `The dev server encountered errors (auto-retry ${retryCountRef.current}/${MAX_AUTO_RETRIES}). Please fix them:\n\n\`\`\`\n${errors}\n\`\`\``;
            submitRef.current?.(errorMsg);
            return;
          }
        }

        // Check preview iframe errors
        if (previewErrors.length > 0) {
          retryCountRef.current++;
          const errorText = previewErrors.join('\n');
          gs().clearPreviewErrors();
          const errorMsg = `I'm getting the following error(s) in my app preview (auto-retry ${retryCountRef.current}/${MAX_AUTO_RETRIES}). Please fix them:\n\n\`\`\`\n${errorText}\n\`\`\``;
          submitRef.current?.(errorMsg);
        }
      }, 3000);

    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        const msg = (err as Error).message;
        gs().updateLastAssistantMessage(
          `Error: ${msg}`,
          `❌ **Error:** ${msg}\n\nPlease check your OpenRouter API key and try again.`
        );
        gs().setSandboxStatus('error');
      }
      gs().setGenerationPhase('idle');
    } finally {
      gs().setIsStreaming(false);
      gs().setActivelyWritingFile(null);

      // Safety net: reset sandboxStatus if still in a transitional state
      // (excludes 'error' so the catch block's setSandboxStatus('error') is preserved)
      const { sandboxStatus: finalStatus, previewUrl: finalPreviewUrl } = gs();
      if (finalStatus === 'installing' || finalStatus === 'starting' || finalStatus === 'booting') {
        gs().setSandboxStatus(finalPreviewUrl ? 'ready' : 'idle');
      }
    }
  }, []); // No reactive dependencies — reads state via getState()

  // Keep submitRef in sync for recursive calls (auto-retry, search continuation)
  submitRef.current = submit;

  const stop = useCallback(() => {
    abortRef.current?.abort();
    gs().setIsStreaming(false);
    gs().setGenerationPhase('idle');
    gs().setActivelyWritingFile(null);

    // Reset sandboxStatus if stuck in a transitional state
    const { sandboxStatus, previewUrl } = gs();
    if (sandboxStatus === 'installing' || sandboxStatus === 'starting' || sandboxStatus === 'booting') {
      gs().setSandboxStatus(previewUrl ? 'ready' : 'idle');
    }
  }, []);

  const submitComponentEdit = useCallback(
    async (
      filePath: string,
      selectionRange: { startLine: number; endLine: number },
      instruction: string
    ) => {
      // Get file content
      const fileContent = gs().files[filePath]?.content;
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
      gs().setComponentEditMode({
        active: true,
        filePath,
        componentName: context.componentName,
      });

      // Submit with component-specific prompt
      await submit(componentPrompt, []);

      // Clear component edit mode after submission
      setTimeout(() => {
        gs().setComponentEditMode({ active: false, filePath: null, componentName: null });
      }, 100);
    },
    [submit]
  );

  return { submit, stop, submitComponentEdit };
}
