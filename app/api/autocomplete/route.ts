import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { OPENROUTER_BASE_URL } from '@/lib/openrouter';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';

const AUTOCOMPLETE_PROMPT = `You are a code autocomplete engine. Given the code context before and after the cursor, output ONLY the code completion. Rules:
- Output ONLY the raw code to insert at the cursor position. No markdown, no backticks, no explanation.
- Keep completions short (1-3 lines max).
- Match the existing code style, indentation, and naming conventions.
- If no useful completion exists, output nothing (empty string).`;

export async function POST(req: NextRequest) {
  const csrfBlock = checkCsrf(req);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(req, { windowMs: 60_000, max: 60 });
  if (rl) return rl;

  const { user, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  let body: { prefix?: string; suffix?: string; language?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ completion: '' });
  }
  const { prefix, suffix, language, apiKey: clientKey } = body;

  if (!prefix && !suffix) {
    return NextResponse.json({ completion: '' });
  }

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
      // fall through
    }
  }

  if (!resolvedKey) {
    resolvedKey = clientKey || '';
  }

  if (!resolvedKey) {
    return NextResponse.json({ completion: '' });
  }

  const openrouter = createOpenAI({
    baseURL: OPENROUTER_BASE_URL,
    apiKey: resolvedKey,
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title': 'AI App Builder',
    },
  });

  try {
    const result = await generateText({
      model: openrouter.chat('stepfun/step-3.5-flash:free'),
      system: AUTOCOMPLETE_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Language: ${language || 'unknown'}\n\nCode before cursor:\n\`\`\`\n${(prefix || '').slice(-1500)}\n\`\`\`\n\nCode after cursor:\n\`\`\`\n${(suffix || '').slice(0, 500)}\n\`\`\``,
        },
      ],
      temperature: 0,
      maxOutputTokens: 128,
    });

    const completion = result.text.trim();

    return NextResponse.json({ completion });
  } catch {
    return NextResponse.json({ completion: '' });
  }
}
