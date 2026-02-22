export type FileAction = { type: 'file'; filePath: string; content: string };
export type ShellAction = { type: 'shell'; command: string };
export type StartAction = { type: 'start'; command: string };
export type SearchAction = { type: 'search'; query: string };
export type BoltAction = FileAction | ShellAction | StartAction | SearchAction;

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

  function processBuffer() {
    let safety = 0;
    while (buffer.length > 0 && safety++ < 1000) {
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

  function emitAction(attrsStr: string, body: string) {
    const typeMatch = attrsStr.match(/type="([^"]+)"/);
    if (!typeMatch) return;

    const type = typeMatch[1] as BoltAction['type'];

    if (type === 'file') {
      const filePathMatch = attrsStr.match(/filePath="([^"]+)"/);
      if (filePathMatch) {
        onAction({ type: 'file', filePath: filePathMatch[1], content: body });
      }
    } else if (type === 'shell') {
      onAction({ type: 'shell', command: body.trim() });
    } else if (type === 'start') {
      onAction({ type: 'start', command: body.trim() });
    } else if (type === 'search') {
      onAction({ type: 'search', query: body.trim() });
    }
  }

  return {
    feed(chunk: string) {
      buffer += chunk;
      processBuffer();
    },
    flush() {
      // If we're mid-content when stream ends, emit whatever we have
      if (state === State.CONTENT && content.length > 0) {
        emitAction(attrs, content);
      }
      buffer = '';
      attrs = '';
      content = '';
      state = State.TEXT;
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
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}