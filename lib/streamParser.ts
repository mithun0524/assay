export type FileAction = { type: 'file'; filePath: string; content: string };
export type ShellAction = { type: 'shell'; command: string };
export type StartAction = { type: 'start'; command: string };
export type SearchAction = { type: 'search'; query: string };
/** Read a file back out of the sandbox before editing it. */
export type ReadAction = { type: 'read'; filePath: string };
/** List what actually exists in the sandbox. */
export type ListAction = { type: 'list'; pattern: string };
/** Remove a file — refactors used to leave orphans behind. */
export type DeleteAction = { type: 'delete'; filePath: string };
export type BoltAction =
  | FileAction
  | ShellAction
  | StartAction
  | SearchAction
  | ReadAction
  | ListAction
  | DeleteAction;

type Callback = (action: BoltAction) => void | Promise<void>;

const enum State {
  TEXT,         // Outside any tag — looking for '<boltAction'
  OPEN_TAG,    // Found '<boltAction', reading attributes until '>'
  CONTENT,     // Inside the tag body, reading until '</boltAction>'
}

const OPEN_TAG = '<boltAction';
const CLOSE_TAG = '</boltAction>';

/**
 * State machine stream parser for <boltAction> tags.
 * Handles partial chunks, malformed output, and unclosed tags gracefully.
 */
export function createStreamParser(onAction: Callback) {
  let state = State.TEXT;
  let buffer = '';
  let attrs = '';
  let content = '';

  // Actions are handled asynchronously (file writes hit the sandbox). Chain them
  // so they run in emission order, and so flush() can await the whole batch —
  // otherwise shell commands fire before the files they depend on exist.
  let queue: Promise<void> = Promise.resolve();

  function processBuffer() {
    while (buffer.length > 0) {
      switch (state) {
        case State.TEXT: {
          const idx = buffer.indexOf(OPEN_TAG);
          if (idx === -1) {
            // No opening tag found. Keep only the tail that could be a partial match.
            // e.g., buffer ends with '<bolt' — keep it, discard everything before.
            const keepFrom = findPartialMatch(buffer, OPEN_TAG);
            buffer = keepFrom >= 0 ? buffer.slice(keepFrom) : '';
            return; // need more data
          }
          // Found opening tag
          buffer = buffer.slice(idx + OPEN_TAG.length);
          state = State.OPEN_TAG;
          attrs = '';
          break;
        }

        case State.OPEN_TAG: {
          const closeAngle = buffer.indexOf('>');
          if (closeAngle === -1) {
            // Attributes not yet complete
            attrs += buffer;
            buffer = '';
            return; // need more data
          }
          attrs += buffer.slice(0, closeAngle);
          buffer = buffer.slice(closeAngle + 1);
          state = State.CONTENT;
          content = '';
          break;
        }

        case State.CONTENT: {
          const closeIdx = buffer.indexOf(CLOSE_TAG);
          if (closeIdx === -1) {
            // No closing tag yet. Keep content, but check for partial match at end.
            const keepFrom = findPartialMatch(buffer, CLOSE_TAG);
            if (keepFrom >= 0) {
              content += buffer.slice(0, keepFrom);
              buffer = buffer.slice(keepFrom);
            } else {
              content += buffer;
              buffer = '';
            }
            return; // need more data
          }
          // Found closing tag — emit action
          content += buffer.slice(0, closeIdx);
          buffer = buffer.slice(closeIdx + CLOSE_TAG.length);
          emitAction(attrs, content);
          state = State.TEXT;
          break;
        }
      }
    }
  }

  /** Read an attribute value, tolerating single or double quotes. */
  function attr(attrsStr: string, name: string): string | null {
    const m = attrsStr.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
    return m ? (m[2] ?? m[3] ?? '').trim() : null;
  }

  function dispatch(action: BoltAction) {
    // Never let one failed action stop the rest of the stream.
    queue = queue.then(() => onAction(action)).catch((err) => {
      console.error('[streamParser] action failed:', action.type, err);
    });
  }

  function emitAction(attrsStr: string, body: string) {
    const type = attr(attrsStr, 'type') as BoltAction['type'] | null;
    if (!type) return;

    if (type === 'file') {
      const filePath = attr(attrsStr, 'filePath');
      if (filePath) {
        dispatch({ type: 'file', filePath, content: body });
      }
    } else if (type === 'shell') {
      dispatch({ type: 'shell', command: body.trim() });
    } else if (type === 'start') {
      dispatch({ type: 'start', command: body.trim() });
    } else if (type === 'search') {
      dispatch({ type: 'search', query: body.trim() });
    } else if (type === 'read') {
      const filePath = attr(attrsStr, 'filePath') || body.trim();
      if (filePath) dispatch({ type: 'read', filePath });
    } else if (type === 'list') {
      dispatch({ type: 'list', pattern: body.trim() });
    } else if (type === 'delete') {
      const filePath = attr(attrsStr, 'filePath') || body.trim();
      if (filePath) dispatch({ type: 'delete', filePath });
    }
  }

  return {
    feed(chunk: string) {
      buffer += chunk;
      processBuffer();
    },
    /**
     * Finish the stream and wait for every queued action to complete.
     * Callers MUST await this before running shell commands — the actions
     * are async and would otherwise still be in flight.
     */
    flush(): Promise<void> {
      // If we're mid-content when stream ends, emit whatever we have
      if (state === State.CONTENT && content.length > 0) {
        emitAction(attrs, content);
      }
      buffer = '';
      attrs = '';
      content = '';
      state = State.TEXT;
      return queue;
    },
  };
}

/**
 * Find the starting index of a partial match of `needle` at the end of `haystack`.
 * Returns -1 if no partial match exists.
 * Example: haystack = "hello</bolt", needle = "</boltAction>" → returns 5
 */
function findPartialMatch(haystack: string, needle: string): number {
  // Check if the end of haystack matches the beginning of needle
  const maxCheck = Math.min(haystack.length, needle.length - 1);
  for (let len = maxCheck; len >= 1; len--) {
    if (haystack.slice(-len) === needle.slice(0, len)) {
      return haystack.length - len;
    }
  }
  return -1;
}

export function stripActions(text: string): string {
  return text
    .replace(/<boltAction[\s\S]*?<\/boltAction>/g, '')
    // An unterminated action — the stream cut off, or the model never closed
    // the tag. Without this the raw opening tag and the whole file body render
    // into the transcript as prose.
    .replace(/<boltAction[\s\S]*$/g, '')
    // Some models wrap their output in tool-call markup. We do not use it, but
    // it arrived in the text anyway and rendered as a stray "</tool_call>" in
    // the middle of the agent's message.
    .replace(/<\/?tool_call>/g, '')
    .replace(/<\/?function_calls?>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Did this turn actually do anything?
 *
 * A model that answers with tool-call markup instead of boltAction markup
 * produces no actions at all: no files are written, nothing throws, and the
 * turn ends looking successful. The user is left with an agent that said "I'll
 * build a complete application" and an empty project behind a blank preview.
 *
 * Callers use this to tell the difference between "the agent chose to only
 * talk" and "the agent meant to build something and none of it landed".
 */
export function claimsToBuild(text: string): boolean {
  return /\b(I'?ll|I am going to|Let me|I will)\b[\s\S]{0,80}\b(create|build|scaffold|write|set up|generate|add)\b/i
    .test(text);
}