import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { OPENROUTER_BASE_URL } from '@/lib/openrouter';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';

const VALID_ROLES = ['architect', 'assistant', 'coder', 'debugger', 'designer', 'tester'] as const;
type Role = (typeof VALID_ROLES)[number];

const CLASSIFIER_MODELS = [
  'arcee-ai/trinity-large-preview:free',
  'stepfun/step-3.5-flash:free',
];

const CLASSIFY_SYSTEM_PROMPT = `You are an intent classifier. Given a user message and context, classify the intent and pick the best model.

Respond with ONLY a JSON object, no other text: {"role":"<role>","model":"<model>","reasoning":"<short reason>"}

Roles and recommended models:
- "debugger" (fix bugs, errors, crashes) → stepfun/step-3.5-flash:free
- "designer" (UI, styling, visuals, images) → arcee-ai/trinity-large-preview:free
- "tester" (tests, specs, coverage) → stepfun/step-3.5-flash:free
- "architect" (planning, new project, architecture) → arcee-ai/trinity-large-preview:free
- "assistant" (questions, explanations, search, informational) → stepfun/step-3.5-flash:free
- "coder" (generate/write code, default) → arcee-ai/trinity-large-preview:free

Rules (first match wins):
1. hasErrors=true OR message about fix/debug/bug/error/crash → debugger
2. hasImages=true → designer
3. Message about style/CSS/colors/animation/layout/UI → designer
4. Message about tests/specs/coverage → tester
5. hasProject=false OR message about architecture/planning → architect
6. Message is a question, search request, or asks to explain/describe something → assistant
7. Otherwise → coder`;

function classifyLocally(message: string, context: { hasProject: boolean; hasErrors: boolean; hasImages: boolean }): { role: Role; model: string; reasoning: string } {
  const msg = message.toLowerCase();

  if (context.hasErrors || /\b(fix|debug|bug|error|crash|broken|fail|issue|wrong|not working)\b/.test(msg)) {
    return { role: 'debugger', model: 'stepfun/step-3.5-flash:free', reasoning: 'Error-related keywords detected' };
  }
  if (context.hasImages) {
    return { role: 'designer', model: 'arcee-ai/trinity-large-preview:free', reasoning: 'Images attached' };
  }
  if (/\b(style|css|color|theme|animation|layout|ui|design|font|padding|margin|border|responsive|dark mode|light mode|icon|image|visual)\b/.test(msg)) {
    return { role: 'designer', model: 'arcee-ai/trinity-large-preview:free', reasoning: 'Style/UI keywords detected' };
  }
  if (/\b(test|spec|coverage|jest|vitest|assert|expect|unit test|e2e)\b/.test(msg)) {
    return { role: 'tester', model: 'stepfun/step-3.5-flash:free', reasoning: 'Testing keywords detected' };
  }
  if (!context.hasProject || /\b(architect|plan|scaffold|setup|init|create.*app|new.*project|from scratch)\b/.test(msg)) {
    return { role: 'architect', model: 'arcee-ai/trinity-large-preview:free', reasoning: 'Architecture/planning or no project' };
  }
  // Informational questions, search requests, explanations
  if (/\b(search|look up|find out|tell me about|explain|describe|define|what is|what does|what are|who is|why does|how does|difference between)\b/.test(msg)) {
    return { role: 'assistant', model: 'stepfun/step-3.5-flash:free', reasoning: 'Informational question detected' };
  }
  if (/^(what|who|where|when|why|how)\s+(is|are|was|were|do|does|did|can|could|would|should)\b/.test(msg)) {
    return { role: 'assistant', model: 'stepfun/step-3.5-flash:free', reasoning: 'Question detected' };
  }
  return { role: 'coder', model: 'arcee-ai/trinity-large-preview:free', reasoning: 'Default to code generation' };
}

export async function POST(req: NextRequest) {
  // ── Security guards ──
  const csrfBlock = checkCsrf(req);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(req, { windowMs: 60_000, max: 60 });
  if (rl) return rl;

  const { user, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { message, context, apiKey: clientKey } = await req.json();

  let resolvedKey = process.env.OPENROUTER_API_KEY || '';

  if (!resolvedKey) {
    try {
      const supabase = await createClient();
      const { data: secrets } = await supabase
        .from('user_secrets')
        .select('openrouter_key')
        .eq('user_id', user.id)
        .single();
      if (secrets?.openrouter_key) {
        resolvedKey = secrets.openrouter_key;
      }
    } catch {
      // fall through
    }
  }

  if (!resolvedKey) resolvedKey = clientKey || '';

  if (!resolvedKey) {
    // No key — use local classifier, still works
    const local = classifyLocally(message, context);
    return Response.json(local);
  }

  const openrouter = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: resolvedKey,
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'AI App Builder',
    },
  });

  const userPrompt = `Context: hasProject=${context.hasProject}, fileCount=${context.fileCount}, hasErrors=${context.hasErrors}, hasImages=${context.hasImages}
Message: "${String(message).slice(0, 300)}"`;

  for (const classifierModel of CLASSIFIER_MODELS) {
    try {
      const result = await generateText({
        model: openrouter.chat(classifierModel),
        system: CLASSIFY_SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 150,
        temperature: 0,
        abortSignal: AbortSignal.timeout(6000),
      });

      const text = result.text.trim();
      if (!text) continue;

      const jsonMatch = text.match(/\{[\s\S]*?"role"\s*:\s*"([^"]*)"[\s\S]*?\}/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]);
      if (!VALID_ROLES.includes(parsed.role)) continue;

      return Response.json({
        role: parsed.role,
        model: parsed.model || 'arcee-ai/trinity-large-preview:free',
        reasoning: parsed.reasoning || '',
      });
    } catch {
      continue;
    }
  }

  // All LLM attempts failed — deterministic fallback
  const local = classifyLocally(message, context);
  return Response.json(local);
}
