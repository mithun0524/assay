import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';
import { OPENROUTER_BASE_URL, fallbackChain } from '@/lib/openrouter';
import { AGENT_TOOLS, toolCallToAction } from '@/lib/agentTools';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  // ── Security guards ──
  const csrfBlock = checkCsrf(req);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(req, { windowMs: 60_000, max: 30 });
  if (rl) return rl;

  const { user, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const {
    messages,
    model,
    fileContext,
    systemPrompt: customSystemPrompt,
    temperature: customTemperature,
  } = await req.json();

  // Key resolution: env var → user's DB-stored key → client-provided key
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
      // DB error — fall through to client key
    }
  }

  if (!resolvedKey) {
    return new Response(
      JSON.stringify({ error: 'No API key configured. Please add your OpenRouter API key in Settings (gear icon).' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Use custom system prompt if provided, otherwise use default
  // Append file context to system prompt so AI knows about existing project files
  const basePrompt = customSystemPrompt || SYSTEM_PROMPT;
  const systemPrompt = fileContext ? basePrompt + '\n\n' + fileContext : basePrompt;

  const openrouter = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: resolvedKey,
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'AI App Builder',
    },
  });

  // Sanitize: Force all message content to be plain strings (no multimodal arrays).
  const sanitizedMessages = messages.map((m: any) => {
    let content = m.content;

    if (Array.isArray(content)) {
      const textParts = content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
      content = textParts;
    }

    return {
      role: m.role,
      content: content || ''
    };
  });

  // Free-tier models drop out under load, so try the next allow-listed model
  // instead of handing the user a dead turn.
  const chain = fallbackChain(model);
  let lastErr: unknown = null;

  for (const candidate of chain) {
    try {
      const result = streamText({
        // CRITICAL: Use .chat() to force the Chat Completions API (/v1/chat/completions).
        model: openrouter.chat(candidate),
        system: systemPrompt,
        messages: sanitizedMessages,
        tools: AGENT_TOOLS,
        temperature:
          typeof customTemperature === 'number' && customTemperature >= 0 && customTemperature <= 2
            ? customTemperature
            : 0.2,
        // A whole project runs past most provider defaults; a truncated stream
        // means half-written files in the sandbox.
        maxOutputTokens: 16000,
      });

      // Touch the stream before committing to it so an immediate upstream
      // rejection (429 / resource exhausted) falls through to the next model.
      const reader = result.fullStream.getReader();
      const encoder = new TextEncoder();
      const render = (part: any): string | null => {
        if (part.type === 'error' || part.type === 'tool-error') {
          const e = part.error ?? part.errorText ?? 'stream error';
          throw e instanceof Error ? e : new Error(String(e));
        }
        if (part.type === 'text-delta') {
          const t = part.text ?? part.textDelta ?? part.delta;
          return typeof t === 'string' ? t : null;
        }
        if (part.type === 'tool-call') {
          const a = toolCallToAction(part.toolName ?? part.name, part.input ?? part.args);
          return a ? `\n${a}\n` : null;
        }
        return null;
      };
      let firstOut: string | null = null; let drained = false;
      for (;;) { const { done, value } = await reader.read();
        if (done) { drained = true; break; }
        if (!value) continue; const o = render(value); if (o) { firstOut = o; break; } }
      if (drained && !firstOut) throw new Error(`${candidate} produced an empty response — model unavailable`);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          if (firstOut) controller.enqueue(encoder.encode(firstOut));
          (async () => {
            try { for (;;) { const { done, value } = await reader.read();
                if (done) break; if (!value) continue;
                const o = render(value); if (o) controller.enqueue(encoder.encode(o)); }
              controller.close();
            } catch (e) { controller.error(e); }
          })();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Model-Used': candidate,
        },
      });
    } catch (err: unknown) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[chat] ${candidate} unavailable, trying next:`, message.slice(0, 200));
      if (!/429|rate|exhaust|unavailable|capacity|timeout|502|503/i.test(message)) {
        break; // a real error (bad key, bad request) won't be fixed by another model
      }
    }
  }

  const message = lastErr instanceof Error ? lastErr.message : '';
  if (/429|rate|exhaust/i.test(message)) {
    return new Response(
      JSON.stringify({ error: 'Every free model is busy right now. Wait a few seconds and send again.' }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '15' } }
    );
  }
  return new Response(
    JSON.stringify({ error: 'Chat request failed. Please try again.' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
