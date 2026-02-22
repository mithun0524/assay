import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  // ── Security guards ──
  const csrfBlock = checkCsrf(req);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(req, { windowMs: 60_000, max: 20 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Search is not configured on the server.' },
      { status: 500 }
    );
  }

  let body: { query?: string; maxResults?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ error: 'Missing "query" field.' }, { status: 400 });
  }

  const maxResults = Math.min(Math.max(body.maxResults ?? 5, 1), 10);

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: maxResults,
      }),
    });

    if (res.status === 429) {
      return NextResponse.json(
        { error: 'Search rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Search request failed. Please try again.' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Search request failed. Please try again.' },
      { status: 500 }
    );
  }
}
