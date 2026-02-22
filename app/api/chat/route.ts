import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';
import { SYSTEM_PROMPT } from '@/lib/systemPrompt';
import { OPENROUTER_BASE_URL } from '@/lib/openrouter';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const {
    messages,
    model,
    apiKey: clientKey,
    fileContext,
    systemPrompt: customSystemPrompt,
    temperature: customTemperature,
  } = await req.json();

  // Key resolution: env var → user's DB-stored key → client-provided key
  let resolvedKey = process.env.OPENROUTER_API_KEY || '';

  if (!resolvedKey) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: secrets } = await supabase
          .from('user_secrets')
          .select('openrouter_key')
          .eq('user_id', user.id)
          .single();
        if (secrets?.openrouter_key) {
          resolvedKey = secrets.openrouter_key;
        }
      }
    } catch {
      // Not authenticated or DB error — fall through to client key
    }
  }

  if (!resolvedKey) {
    resolvedKey = clientKey || '';
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

  try {
    const result = await streamText({
      // CRITICAL: Use .chat() to force the Chat Completions API (/v1/chat/completions).
      // The default openrouter() uses the Responses API (/v1/responses) which OpenRouter doesn't support.
      model: openrouter.chat(model ?? 'stepfun/step-3.5-flash:free'),
      system: systemPrompt,
      messages: sanitizedMessages,
      temperature: customTemperature ?? 0.2,
    });

    return result.toTextStreamResponse();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // Handle rate limit
    if (message.includes('429')) {
      return new Response(
        JSON.stringify({ error: 'Rate limit hit. Please wait 10 seconds and try again.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
