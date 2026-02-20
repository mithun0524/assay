export type FileAction = { type: 'file'; filePath: string; content: string };
export type ShellAction = { type: 'shell'; command: string };
export type StartAction = { type: 'start'; command: string };
export type BoltAction = FileAction | ShellAction | StartAction;

type Callback = (action: BoltAction) => void | Promise<void>;

export function createStreamParser(onAction: Callback) {
  let buffer = '';
  let processedUpTo = 0;

  return {
    feed(chunk: string) {
      buffer += chunk;
      processBuffer();
    },
    flush() {
      processBuffer();
      buffer = '';
      processedUpTo = 0;
    },
  };

  function processBuffer() {
    const searchFrom = Math.max(0, processedUpTo - 20);
    const slice = buffer.slice(searchFrom);
    const regex = /<boltAction\s+([^>]+)>([\s\S]*?)<\/boltAction>/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(slice)) !== null) {
      const absoluteEnd = searchFrom + match.index + match[0].length;
      if (absoluteEnd <= processedUpTo) continue;
      processedUpTo = absoluteEnd;

      const attrsStr = match[1];
      const content = match[2];
      const typeMatch = attrsStr.match(/type="([^"]+)"/);
      const filePathMatch = attrsStr.match(/filePath="([^"]+)"/);

      if (!typeMatch) continue;
      const type = typeMatch[1] as BoltAction['type'];

      if (type === 'file' && filePathMatch) {
        onAction({ type: 'file', filePath: filePathMatch[1], content });
      } else if (type === 'shell') {
        onAction({ type: 'shell', command: content.trim() });
      } else if (type === 'start') {
        onAction({ type: 'start', command: content.trim() });
      }
    }
  }
}

export function stripActions(text: string): string {
  return text
    .replace(/<boltAction[\s\S]*?<\/boltAction>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}