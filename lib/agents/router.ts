/**
 * Agent router — decides which agent (and model) handles a message.
 *
 * `classifyLocally` is the single source of truth: it runs both on the client
 * (regex fallback) and inside /api/classify (no-key / LLM-failure fallback).
 */

import type { AgentRole, AgentContext } from './types';
import { MODEL_IDS, resolveModelId } from '../openrouter';

/**
 * Result from the LLM-based classification endpoint
 */
export interface ClassificationResult {
  role: AgentRole;
  model: string;
  reasoning: string;
}

export const VALID_ROLES: AgentRole[] = [
  'architect',
  'assistant',
  'coder',
  'debugger',
  'designer',
  'tester',
];

export function isAgentRole(value: unknown): value is AgentRole {
  return typeof value === 'string' && (VALID_ROLES as string[]).includes(value);
}

/** Model each role prefers when the caller hasn't pinned one. */
export const ROLE_MODEL: Record<AgentRole, string> = {
  architect: MODEL_IDS.nemotron,
  assistant: MODEL_IDS.ling,
  coder: MODEL_IDS.nemotron,
  debugger: MODEL_IDS.laguna,
  designer: MODEL_IDS.nemotron,
  tester: MODEL_IDS.ling,
};

/* ── Patterns ─────────────────────────────────────────────
 * All word-bounded. Substring matching used to misroute badly:
 * "build an app" contains "ui", "latest" contains "test".
 */
const GREETING_RE = /^(hi|hey|hello|hola|yo|greetings?|good\s*(morning|afternoon|evening)|how are you|what'?s up|test|testing)[!.?]*$/;
const ERROR_RE = /\b(error|errors|fix|fixes|bug|bugs|broken|crash|crashes|crashing|fail|fails|failed|failing|issue|issues|problem|problems|debug|not working|doesn'?t work|stack trace|exception)\b/;
const DESIGN_RE = /\b(style|styles|styling|css|colou?r|colou?rs|theme|dark mode|light mode|animation|animate|layout|ui|ux|design|font|fonts|padding|margin|border|spacing|responsive|icon|icons|visual|beautiful|pretty|prettier|modern|look nicer|better looking)\b/;
const TEST_RE = /\b(test|tests|testing|spec|specs|coverage|jest|vitest|playwright|cypress|assert|assertion|unit test|e2e)\b/;
const PLANNING_RE = /\b(architect|architecture|plan|planning|scaffold|structure|organi[sz]e|blueprint|from scratch|new project|design pattern|best way|should i)\b/;
const QUESTION_RE = /\b(search|look up|find out|tell me about|explain|describe|define|what is|what are|what does|who is|why does|why is|how does|how do i|difference between|compared to|vs\.?)\b/;
const QUESTION_START_RE = /^(what|who|where|when|why|how)\s+(is|are|was|were|do|does|did|can|could|would|should)\b/;

function withModel(role: AgentRole, reasoning: string): ClassificationResult {
  return { role, model: ROLE_MODEL[role], reasoning };
}

/**
 * Deterministic classification. Never throws — bad input degrades to `coder`
 * on a project, `architect` on an empty workspace.
 */
export function classifyLocally(
  message: unknown,
  context?: Partial<AgentContext> | null
): ClassificationResult {
  const msg = typeof message === 'string' ? message.trim().toLowerCase() : '';
  const ctx = context ?? {};
  const hasProject = ctx.hasProject === true && (ctx.fileCount ?? 1) > 0;

  // Greetings / smoke-test messages first, so "test" isn't read as a QA request
  if (GREETING_RE.test(msg)) {
    return hasProject
      ? withModel('coder', 'Greeting with a project loaded')
      : withModel('architect', 'Greeting with no project yet');
  }

  if (ctx.hasErrors === true || ERROR_RE.test(msg)) {
    return withModel('debugger', ctx.hasErrors ? 'Errors detected in the project' : 'Error-related keywords detected');
  }

  if (ctx.hasImages === true) {
    return withModel('designer', 'Images attached');
  }

  // With no project, the shape of the request matters more than its adjectives:
  // "build a kanban board with a dark theme" is a build, not a styling job.
  if (!hasProject) {
    if (QUESTION_RE.test(msg) || QUESTION_START_RE.test(msg)) {
      return withModel('assistant', 'Question with no project to change');
    }
    return withModel('architect', 'No project yet — planning the initial structure');
  }

  if (DESIGN_RE.test(msg)) {
    return withModel('designer', 'Style/UI keywords detected');
  }

  if (TEST_RE.test(msg)) {
    return withModel('tester', 'Testing keywords detected');
  }

  if (QUESTION_RE.test(msg) || QUESTION_START_RE.test(msg)) {
    return withModel('assistant', 'Informational question detected');
  }

  if (PLANNING_RE.test(msg)) {
    return withModel('architect', 'Architecture/planning request');
  }

  return withModel('coder', 'Default to code generation');
}

/**
 * Route to appropriate agent based on user message and context
 */
export function routeToAgent(userMessage: string, context: AgentContext): AgentRole {
  return classifyLocally(userMessage, context).role;
}

/**
 * Classify user intent via LLM. Returns null on any failure (triggers regex fallback).
 */
export async function classifyWithLLM(
  userMessage: string,
  context: AgentContext
): Promise<ClassificationResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage, context }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[classifyWithLLM] Server returned ${res.status}, falling back to regex`);
      return null;
    }

    const data = await res.json();

    if (!isAgentRole(data?.role)) {
      console.warn(`[classifyWithLLM] Invalid role "${data?.role}", falling back to regex`);
      return null;
    }

    return {
      role: data.role,
      // A classifier can hallucinate a model id — never forward one we can't call.
      model: resolveModelId(data.model),
      reasoning: typeof data.reasoning === 'string' ? data.reasoning : '',
    };
  } catch (err) {
    console.warn('[classifyWithLLM] Failed, falling back to regex:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get agent reasoning (why this agent was chosen)
 */
export function getAgentReasoning(role: AgentRole, context: AgentContext): string {
  switch (role) {
    case 'architect':
      if (!context.hasProject) {
        return 'Planning new project structure';
      }
      return 'Analyzing architecture and design patterns';

    case 'assistant':
      return 'Answering question and providing information';

    case 'coder':
      return 'Implementing features and writing code';

    case 'debugger':
      return 'Analyzing and fixing errors';

    case 'designer':
      if (context.hasImages) {
        return 'Converting design to code';
      }
      return 'Improving UI and user experience';

    case 'tester':
      return 'Writing tests and ensuring quality';

    default:
      return 'Processing request';
  }
}
