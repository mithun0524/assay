import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { OPENROUTER_BASE_URL } from '@/lib/openrouter';

export const runtime = 'edge';

const VALID_ROLES = ['architect', 'coder', 'debugger', 'designer', 'tester'] as const;

const FALLBACK_MODELS = [
  'stepfun/step-3.5-flash:free',
  'liquid/lfm-2.5-1.2b-thinking:free',
];

const CLASSIFY_SYSTEM_PROMPT = `Classify intent. Reply ONLY with JSON: {"role":"…","model":"…","reasoning":"…"}

Rules (first match wins):
hasErrors=true OR fix/debug/bug/crash → debugger, stepfun/step-3.5-flash:free
hasImages=true → designer, nvidia/nemotron-nano-12b-v2-vl:free
style/visual/animation/UI look → designer, google/gemma-3-27b-it:free
test/spec/coverage → tester, stepfun/step-3.5-flash:free
architecture/plan OR hasProject=false → architect, stepfun/step-3.5-flash:free
build/generate code → coder, qwen/qwen3-coder:free
default → coder, stepfun/step-3.5-flash:free`;

export async function POST(req: NextRequest) {
  const { message, context, apiKey: clientKey } = await req.json();

  const resolvedKey = process.env.OPENROUTER_API_KEY || clientKey;

  if (!resolvedKey) {
    return new Response(
      JSON.stringify({ error: 'No API key configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const openrouter = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: resolvedKey,
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'AI App Builder',
    },
  });

  const userPrompt = `Context: hasProject=${context.hasProject}, fileCount=${context.fileCount}, hasErrors=${context.hasErrors}, hasImages=${context.hasImages}\nMessage: "${String(message).slice(0, 300)}"`;

  // Try each model in the fallback chain
  for (const modelId of FALLBACK_MODELS) {
    try {
      const result = await generateText({
        model: openrouter.chat(modelId),
        system: CLASSIFY_SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 80,
        temperature: 0,
        abortSignal: AbortSignal.timeout(8000),
      });

      const text = result.text.trim();

      // Extract JSON from response (may be wrapped in markdown or extra text)
      const jsonMatch = text.match(/\{[^}]*"role"\s*:\s*"[^"]*"[^}]*\}/);
      if (!jsonMatch) {
        console.warn(`[classify] No JSON found in response from ${modelId}:`, text);
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate role
      if (!VALID_ROLES.includes(parsed.role)) {
        console.warn(`[classify] Invalid role "${parsed.role}" from ${modelId}`);
        continue;
      }

      return new Response(
        JSON.stringify({
          role: parsed.role,
          model: parsed.model || 'stepfun/step-3.5-flash:free',
          reasoning: parsed.reasoning || '',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.warn(`[classify] Model ${modelId} failed:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  // All models failed
  return new Response(
    JSON.stringify({ error: 'Classification failed for all models' }),
    { status: 502, headers: { 'Content-Type': 'application/json' } }
  );
}
