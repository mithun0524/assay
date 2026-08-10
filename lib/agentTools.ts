import { tool } from 'ai';
import { z } from 'zod';

/**
 * What the agent is allowed to do, declared as real tools.
 *
 * These carry no `execute`. They cannot: every one of them runs inside a
 * WebContainer, which lives in the browser tab, and this file is imported by a
 * server route. The model's job here is to *decide* — the browser still does
 * the work.
 *
 * Why declare them at all, rather than keep asking for `<boltAction>` markup in
 * prose: a model that supports tool calling is trained to emit tool calls. Ask
 * it for a bespoke XML dialect instead and a good model will often oblige, but
 * a tired one falls back to what it knows — `<tool_call>{...}</tool_call>` —
 * and our parser, which only understands boltAction, finds nothing. No files
 * are written, nothing throws, and the turn ends looking successful with an
 * empty project behind it. That is the blank screen, and no amount of prompt
 * wording reliably prevents it.
 *
 * Given a tool schema, the same model returns validated JSON through the
 * channel it was trained on, and the provider enforces the shape.
 *
 * The server serialises each call back into boltAction markup before it reaches
 * the browser (see app/api/chat/route.ts), so the client keeps the executor and
 * the parser it already has. The wire format is unchanged; what changed is that
 * the model is no longer being asked to hand-write it.
 */

export const AGENT_TOOLS = {
  write_file: tool({
    description:
      'Create a file or replace its entire contents. Always pass the complete ' +
      'final file — never a diff, a fragment, or a placeholder comment. Paths ' +
      'are relative to the project root, e.g. "src/App.tsx".',
    inputSchema: z.object({
      path: z
        .string()
        .min(1)
        .describe('Project-relative path, e.g. "src/components/Board.tsx".'),
      content: z.string().describe('The complete contents of the file.'),
    }),
  }),

  run_command: tool({
    description:
      'Run a shell command in the project sandbox, such as installing ' +
      'dependencies. Use for one-off commands, not for starting the dev server.',
    inputSchema: z.object({
      command: z.string().min(1).describe('e.g. "npm install".'),
    }),
  }),

  start_dev_server: tool({
    description:
      'Start the development server so the app becomes visible in the preview. ' +
      'Call this once, after the files exist and dependencies are installed.',
    inputSchema: z.object({
      command: z
        .string()
        .min(1)
        .describe('e.g. "npm run dev". Must be a long-running server command.'),
    }),
  }),

  read_file: tool({
    description:
      'Read a file that already exists in the project. Prefer this over ' +
      'guessing at contents before editing something.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Project-relative path.'),
    }),
  }),

  delete_file: tool({
    description: 'Delete a file from the project.',
    inputSchema: z.object({
      path: z.string().min(1).describe('Project-relative path.'),
    }),
  }),
} as const;

export type AgentToolName = keyof typeof AGENT_TOOLS;

/** Escape a value for use inside a double-quoted XML attribute. */
function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render a tool call as the boltAction markup the browser already executes.
 *
 * Returns null for a call we do not recognise or whose arguments do not hold
 * up — better to drop one malformed action than to emit half a tag and derail
 * the parser for the rest of the stream.
 */
export function toolCallToAction(name: string, input: unknown): string | null {
  const a = (input ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);

  switch (name) {
    case 'write_file': {
      const path = str(a.path);
      if (!path) return null;
      // Content may legitimately be empty — an empty file is still a file.
      const content = typeof a.content === 'string' ? a.content : '';
      return `<boltAction type="file" filePath="${attr(path)}">${content}</boltAction>`;
    }
    case 'run_command': {
      const command = str(a.command);
      return command ? `<boltAction type="shell">${command}</boltAction>` : null;
    }
    case 'start_dev_server': {
      const command = str(a.command);
      return command ? `<boltAction type="start">${command}</boltAction>` : null;
    }
    case 'read_file': {
      const path = str(a.path);
      return path ? `<boltAction type="read" filePath="${attr(path)}"></boltAction>` : null;
    }
    case 'delete_file': {
      const path = str(a.path);
      return path ? `<boltAction type="delete" filePath="${attr(path)}"></boltAction>` : null;
    }
    default:
      return null;
  }
}
