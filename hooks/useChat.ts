'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { createStreamParser, claimsToBuild } from '@/lib/streamParser';
import { formatForDisplay } from '@/lib/displayFormatter';
import { writeFileToSandbox, runShellInSandbox, startDevServerInSandbox } from '@/lib/fileSystem';
import type { Message } from '@/lib/store';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';
import { buildFileContext } from '@/lib/contextBuilder';
import { routeToAgent, getAgent, getAgentReasoning, AgentContext, classifyWithLLM } from '@/lib/agents';
import type { AgentRole } from '@/lib/agents';
import { planExecution, decideAfterQa, shouldRunQa } from '@/lib/agents/orchestrator';
import type { QaIssue } from '@/lib/qaGate';
import { isValidModelId, resolveModelId } from '@/lib/openrouter';

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


export function useChat() {
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const searchRetryRef = useRef(0);
  const inspectRetryRef = useRef(0);
  const submitRef = useRef<((text: string, images?: string[], opts?: { kind?: 'qa' | 'inspect' | 'search' }) => Promise<void>) | null>(null);
  const MAX_AUTO_RETRIES = 2;
  const MAX_SEARCH_RETRIES = 2;
  const MAX_INSPECT_ROUNDS = 3;

  // Read store actions/state on demand — no reactive subscription
  const gs = useStore.getState;

  const submit = useCallback(async (
    userText: string,
    images: string[] = [],
    opts: { kind?: 'qa' | 'inspect' | 'search' } = {}
  ) => {
    if ((!userText.trim() && images.length === 0) || gs().isStreaming) return;

    const isQaRun = opts.kind === 'qa';

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      images,
      displayContent: userText,
      timestamp: Date.now(),
      kind: opts.kind,
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

    // Reset retry counters on real user messages (not QA/search continuations)
    const isContinuation =
      userText.startsWith('Here are the web search results you requested') ||
      userText.startsWith('Here is the current state of the sandbox');
    if (!isQaRun && !isContinuation) {
      retryCountRef.current = 0;
      searchRetryRef.current = 0;
      inspectRetryRef.current = 0;
      gs().setQaStatus(null);
    }

    // Snapshot current files before AI writes — enables undo
    gs().takeSnapshot();

    let fullContent = '';
    const pendingShells: string[] = [];
    const pendingSearches: string[] = [];
    const pendingReads: string[] = [];
    const pendingLists: string[] = [];
    const pendingDeletes: string[] = [];
    let pendingStart: string | null = null;
    let firstFileWritten = false;
    const collectedFileActions: Array<{ filePath: string; content: string }> = [];

    // Counts what this turn actually did, so a turn that produced nothing can
    // be told apart from one that deliberately only answered a question.
    let filesWrittenThisTurn = 0;

    // Writes that did not land. The model has no way to observe this on its
    // own — the tools run here, in the browser, and the stream is one-way — so
    // a rejected path or a sandbox error would otherwise be invisible to it and
    // it would keep building against files that do not exist. These are fed
    // back through the QA gate, which already owns the retry budget.
    const toolFailures: QaIssue[] = [];
    const noteFailure = (filePath: string, reason: string) => {
      toolFailures.push({
        source: 'tool',
        message: `write_file("${filePath}") failed: ${reason}`,
      });
    };

    const parser = createStreamParser(async (action) => {
      if (action.type === 'file') {
        filesWrittenThisTurn++;
        gs().setActivelyWritingFile(action.filePath);
        gs().setGenerationPhase('writing');

        try {
          // If diff preview is enabled, collect changes instead of writing immediately
          if (gs().showDiffPreview) {
            collectedFileActions.push({ filePath: action.filePath, content: action.content });
          } else {
            const written = await writeFileToSandbox(action.filePath, action.content);
            if (written === null) {
              noteFailure(
                action.filePath,
                'that is not a usable project-relative path, so nothing was written'
              );
              return;
            }
          }
        } catch (err) {
          noteFailure(action.filePath, err instanceof Error ? err.message : String(err));
          return;
        } finally {
          // Must clear on the failure path too, or the status line is stuck
          // reporting a write that already gave up.
          gs().setActivelyWritingFile(null);
        }

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
      } else if (action.type === 'read') {
        pendingReads.push(action.filePath);
      } else if (action.type === 'list') {
        pendingLists.push(action.pattern);
      } else if (action.type === 'delete') {
        pendingDeletes.push(action.filePath);
      }
    });

    try {
      // User-triggered web search: prepend results to the user message
      let searchPrefix = '';
      // Toggle = "always research first". With it off the agent can still emit its
      // own <boltAction type="search"> whenever it doesn't know something.
      if (gs().webSearchEnabled && !isQaRun && userText.trim() && !userText.startsWith('Here are the web search results you requested')) {
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
        hasErrors: gs().previewErrors.length > 0 || gs().terminalErrors.length > 0,
        lastMessage: userText,
        hasImages: images.length > 0,
      };

      // LLM-based classification with regex fallback
      let agentRole: AgentRole;
      let agentModel: string | undefined;
      const classification = await classifyWithLLM(userText, agentContext);
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
      gs().setLastAssistantAgent(agentRole);
      gs().setActiveAgentReasoning(agentReasoning);

      // An explicit model pick in the UI wins; 'auto' defers to the router.
      const userModel = gs().selectedModel;
      const model = isValidModelId(userModel) ? userModel : resolveModelId(agentModel || agent.model);

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
          contentTokens = m.content.reduce((subAcc: number, item: { type: string; text?: string }) => {
            if (item.type === 'text') return subAcc + estimateTokens(item.text ?? '');
            if (item.type === 'image_url') return subAcc + 1000;
            return subAcc;
          }, 0);
        } else {
          contentTokens = estimateTokens(String(m.content));
        }
        return acc + contentTokens;
      }, 0);
      const baseUsage = systemTokens + historyTokens;
      gs().setTokenUsage(baseUsage);

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          model, // user pick, else LLM/agent choice
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

      // Wait for every queued file write to land before running shell commands.
      await parser.flush();

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
            submitRef.current?.(searchResultsMsg, [], { kind: 'search' });
            return;
          }
        } catch (e) {
          console.warn('AI-requested search failed:', e);
        } finally {
          gs().setIsSearching(false);
        }
      }

      // ── Sandbox inspection ──
      // The agent asked to read/list/delete. Deletions apply immediately; reads
      // and lists are answered with ground truth and the turn continues.
      if (pendingReads.length > 0 || pendingLists.length > 0 || pendingDeletes.length > 0) {
        const { buildInspectionReport, hasInspection, matchFiles } = await import('@/lib/agents/inspector');
        const { readFileFromSandbox, deleteFileFromSandbox } = await import('@/lib/fileSystem');

        const deletes = [] as Array<{ path: string; ok: boolean }>;
        for (const path of pendingDeletes.slice(0, 20)) {
          deletes.push({ path, ok: await deleteFileFromSandbox(path) });
        }

        const reads = [] as Array<{ path: string; content: string | null }>;
        for (const path of pendingReads.slice(0, 5)) {
          const fromSandbox = await readFileFromSandbox(path);
          reads.push({ path, content: fromSandbox ?? gs().files[path]?.content ?? null });
        }

        const allPaths = Object.keys(gs().files);
        const lists = pendingLists.slice(0, 3).map((pattern) => ({
          pattern,
          matches: matchFiles(allPaths, pattern),
        }));

        const result = { reads, lists, deletes };
        if (hasInspection(result) && inspectRetryRef.current < MAX_INSPECT_ROUNDS) {
          inspectRetryRef.current++;
          gs().setIsStreaming(false);
          await submitRef.current?.(buildInspectionReport(result), [], { kind: 'inspect' });
          return;
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

      // ── Execute what the model asked for ──
      // The plan (what to run, whether to install, whether to (re)start the
      // server) is decided by a pure function so it can be tested directly.
      const { readPackageJson } = await import('@/lib/sandboxUtils');
      const pkg = readPackageJson();
      const plan = planExecution({
        shells: pendingShells,
        start: pendingStart,
        wroteFiles: firstFileWritten,
        serverWasRunning: gs().sandboxStatus === 'ready' || !!gs().previewUrl,
        hasRunnableProject: Boolean(pkg?.scripts?.dev || pkg?.scripts?.start),
      });

      if (plan.stopServerFirst) {
        const { stopDevServer } = await import('@/lib/fileSystem');
        await stopDevServer();
      }

      if (plan.shellCommands.length > 0) {
        gs().setGenerationPhase('installing');
        if (plan.hasInstallCommand) gs().setSandboxStatus('installing');
        for (const cmd of plan.shellCommands) {
          await runShellInSandbox(cmd);
        }
      }

      if (plan.runInstall) {
        gs().setGenerationPhase('installing');
        const { installDependencies } = await import('@/lib/fileSystem');
        await installDependencies();
      }

      if (plan.startServer) {
        gs().setGenerationPhase('starting');
        await startDevServerInSandbox().catch((err) => {
          // The sandbox already recorded the failure; let QA pick it up
          // instead of aborting the whole turn.
          console.warn('[useChat] dev server failed to start:', err);
        });
      } else if (plan.resetStatusToIdle) {
        const currentStatus = gs().sandboxStatus;
        if (currentStatus === 'installing' || currentStatus === 'starting') {
          gs().setSandboxStatus('idle');
        }
      }

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

      // ── QA gate ──
      // Verify the app actually builds and runs before handing it over. Any
      // failure is delegated back to the debugger agent automatically.
      // A turn whose every write failed sets none of the flags shouldRunQa looks
      // at, so without this the one thing worth reporting is the one thing that
      // silently skips the gate.
      if (
        toolFailures.length > 0 ||
        shouldRunQa({ wroteFiles: firstFileWritten, shells: pendingShells, start: pendingStart, awaitingReview: false })
      ) {
        gs().setGenerationPhase('verifying');
        const { runQaCheck, buildQaFixPrompt, summarizeQaIssues } = await import('@/lib/qaGate');
        const issues = await runQaCheck(abortRef.current?.signal, toolFailures);
        const decision = decideAfterQa(issues, retryCountRef.current, MAX_AUTO_RETRIES);

        if (decision.action === 'fix') {
          retryCountRef.current = decision.attempt;
          gs().setQaStatus({
            state: 'fixing',
            summary: summarizeQaIssues(issues),
            attempt: retryCountRef.current,
            maxAttempts: MAX_AUTO_RETRIES,
          });
          gs().clearPreviewErrors();
          gs().clearTerminalErrors();
          gs().setIsStreaming(false);
          await submitRef.current?.(
            buildQaFixPrompt(issues, retryCountRef.current, MAX_AUTO_RETRIES),
            [],
            { kind: 'qa' }
          );
          return;
        }

        gs().setQaStatus(
          decision.action === 'pass'
            ? { state: 'passed', summary: 'QA passed — the app builds and runs', attempt: retryCountRef.current, maxAttempts: MAX_AUTO_RETRIES }
            : { state: 'failed', summary: summarizeQaIssues(issues), attempt: retryCountRef.current, maxAttempts: MAX_AUTO_RETRIES }
        );
      }

      // A turn can finish having written nothing at all and still look like a
      // success: some models answer with tool-call markup instead of the
      // action markup this app parses, so the parser yields nothing, no file
      // is written, and nothing throws. The user is left with an agent that
      // promised an application and a blank preview that never explains why.
      //
      // Only flagged when the agent said it was going to build something —
      // answering a question without touching a file is normal and silent.
      if (filesWrittenThisTurn === 0) {
        const said = gs().messages.filter((m) => m.role === 'assistant').at(-1)?.displayContent ?? '';
        if (claimsToBuild(said)) {
          gs().addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            agent: 'debugger',
            content: '',
            displayContent:
              'That turn finished without writing any files, so nothing changed and the preview will be unchanged. ' +
              'This usually means the model replied in a format the builder could not read. Try sending the request again.',
            timestamp: Date.now(),
          });
        }
      }

      gs().setGenerationPhase('done');
      setTimeout(() => gs().setGenerationPhase('idle'), 3000);

    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        const msg = (err as Error).message;
        // Say what happened and what to do about it — the old copy blamed the
        // API key even when the real cause was a signed-out session.
        const hint = /not authenticated|authentication failed|401|sign in/i.test(msg)
          ? 'Your session expired. Sign in again to keep building.'
          : /no api key|api key/i.test(msg)
            ? 'Add your OpenRouter key in Settings to continue.'
            : /rate limit|429/i.test(msg)
              ? 'Wait for the countdown in the composer, then send again.'
              : 'Send the message again, or rephrase it if this keeps happening.';
        gs().updateLastAssistantMessage(`Error: ${msg}`, `**${msg}**\n\n${hint}`);
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
