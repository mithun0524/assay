import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { OPENROUTER_BASE_URL, MODEL_IDS, resolveModelId } from '@/lib/openrouter';
import { classifyLocally, isAgentRole, ROLE_MODEL } from '@/lib/agents/router';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';

// Cheapest/fastest first — classification is a tiny task.
const CLASSIFIER_MODELS = [MODEL_IDS.lingTiny, MODEL_IDS.laguna, MODEL_IDS.gemma];

const CLASSIFY_SYSTEM_PROMPT = `You are an intent classifier. Given a user message and context, classify the intent and pick the best model.

Respond with ONLY a JSON object, no other text: {"role":"<role>","model":"<model>","reasoning":"<short reason>"}

Roles and recommended models:
- "debugger" (fix bugs, errors, crashes) → ${ROLE_MODEL.debugger}
- "designer" (UI, styling, visuals, images) → ${ROLE_MODEL.designer}
- "tester" (tests, specs, coverage) → ${ROLE_MODEL.tester}
- "architect" (planning, new project, architecture) → ${ROLE_MODEL.architect}
- "assistant" (questions, explanations, search, informational) → ${ROLE_MODEL.assistant}
- "coder" (generate/write code, default) → ${ROLE_MODEL.coder}

Rules (first match wins):
1. Message is only a greeting ("hi", "test") → coder if hasProject=true, else architect
2. hasErrors=true OR message about fix/debug/bug/error/crash → debugger
3. hasImages=true → designer
4. Message about style/CSS/colors/animation/layout/UI → designer
5. Message about tests/specs/coverage → tester
6. Message is a question, search request, or asks to explain/describe something → assistant
7. hasProject=false OR message about architecture/planning → architect
8. Otherwise → coder`;

export async function POST(req: NextRequest) {
  // ── Security guards ──
  const csrfBlock = checkCsrf(req);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(req, { windowMs: 60_000, max: 60 });
  if (rl) return rl;

  const { user, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  // ── Input validation (untrusted body) ──
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message : '';
  const raw = (body.context ?? {}) as Record<string, unknown>;
  const context = {
    hasProject: raw.hasProject === true,
    fileCount: typeof raw.fileCount === 'number' ? raw.fileCount : 0,
    hasErrors: raw.hasErrors === true,
    hasImages: raw.hasImages === true,
  };

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

  if (!resolvedKey) {
    // No key — use local classifier, still works
    return Response.json(classifyLocally(message, context));
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
Message: "${message.slice(0, 300)}"`;

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
      const role = parsed?.role;
      if (!isAgentRole(role)) continue;

      return Response.json({
        role,
        // Ignore a hallucinated model id; fall back to the role's own model.
        model: resolveModelId(parsed.model) === parsed.model ? parsed.model : ROLE_MODEL[role],
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      });
    } catch {
      continue;
    }
  }

  // All LLM attempts failed — deterministic fallback
  return Response.json(classifyLocally(message, context));
}
