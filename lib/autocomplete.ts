import type * as Monaco from 'monaco-editor';

const AUTOCOMPLETE_STORAGE_KEY = 'devforge-autocomplete-enabled';

export function isAutocompleteEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(AUTOCOMPLETE_STORAGE_KEY) !== 'false'; // default on
}

export function setAutocompleteEnabled(enabled: boolean): void {
  localStorage.setItem(AUTOCOMPLETE_STORAGE_KEY, String(enabled));
}

/**
 * Register an inline completions provider for Monaco that fetches
 * AI-powered ghost text suggestions from /api/autocomplete.
 * Returns a disposable that cleans up timers and in-flight requests.
 */
export function registerAutocompleteProvider(
  monaco: typeof Monaco,
): Monaco.IDisposable {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  const providerDisposable = monaco.languages.registerInlineCompletionsProvider('*', {
    provideInlineCompletions: async (model, position, _context, token) => {
      if (!isAutocompleteEnabled()) {
        return { items: [] };
      }

      // Cancel any in-flight request
      if (abortController) {
        abortController.abort();
        abortController = null;
      }

      // Clear pending debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      return new Promise((resolve) => {
        debounceTimer = setTimeout(async () => {
          debounceTimer = null;

          if (token.isCancellationRequested) {
            resolve({ items: [] });
            return;
          }

          const textUntilPosition = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const textAfterPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: model.getLineCount(),
            endColumn: model.getLineMaxColumn(model.getLineCount()),
          });

          // Don't trigger on very short prefixes or empty lines
          const currentLine = model.getLineContent(position.lineNumber);
          const trimmedLine = currentLine.substring(0, position.column - 1).trim();
          if (trimmedLine.length < 3) {
            resolve({ items: [] });
            return;
          }

          const language = model.getLanguageId();
          const apiKey = typeof window !== 'undefined'
            ? localStorage.getItem('openrouter-api-key')
            : null;

          abortController = new AbortController();

          try {
            const res = await fetch('/api/autocomplete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prefix: textUntilPosition,
                suffix: textAfterPosition,
                language,
                apiKey,
              }),
              signal: abortController.signal,
            });

            if (!res.ok || token.isCancellationRequested) {
              resolve({ items: [] });
              return;
            }

            const data = await res.json();
            const completion = data.completion;

            if (!completion) {
              resolve({ items: [] });
              return;
            }

            resolve({
              items: [
                {
                  insertText: completion,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                },
              ],
            });
          } catch {
            resolve({ items: [] });
          }
        }, 600);
      });
    },

    disposeInlineCompletions: () => {
      // Nothing per-completion to dispose
    },
  });

  // Return a disposable that also cleans up timers/requests
  return {
    dispose: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      providerDisposable.dispose();
    },
  };
}
