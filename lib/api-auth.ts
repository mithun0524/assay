/**
 * Shared API route security utilities:
 *  – Authentication guard (Supabase session check)
 *  – CSRF origin validation
 *  – In-memory rate limiter
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/* ── Types ───────────────────────────────────────── */

type AuthResult =
  | { user: { id: string }; error: null }
  | { user: null; error: NextResponse };

/* ── Auth guard ──────────────────────────────────── */

/**
 * Verify the current request has a valid Supabase session.
 * Returns the user on success or a 401 response on failure.
 */
export async function requireAuth(): Promise<AuthResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 },
        ),
      };
    }

    return { user, error: null };
  } catch {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 },
      ),
    };
  }
}

/* ── CSRF origin check ───────────────────────────── */

const ALLOWED_ORIGINS = new Set([
  process.env.NEXT_PUBLIC_APP_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean));

/**
 * For state-changing requests (POST / PUT / DELETE) verify that the
 * Origin or Referer header matches the app's own origin.
 * Returns null if valid, or a 403 response if the origin is suspicious.
 */
export function checkCsrf(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null; // Safe methods — skip
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If both are absent this is likely a server-to-server or same-origin fetch
  // (browsers always send Origin on cross-origin POST).
  if (!origin && !referer) {
    return null;
  }

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return null;
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (ALLOWED_ORIGINS.has(refOrigin)) {
        return null;
      }
    } catch { /* malformed referer — fall through */ }
  }

  return NextResponse.json(
    { error: 'Forbidden — cross-origin request rejected' },
    { status: 403 },
  );
}

/* ── Rate limiter (in-memory, per-IP) ────────────── */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

// Periodic cleanup to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, 60_000);

/**
 * Simple fixed-window rate limiter.
 * @param request — incoming request (IP is derived from headers)
 * @param windowMs — window size in ms (default 60 s)
 * @param max — max requests per window (default 30)
 * @returns null if allowed, or a 429 Response if rate-limited
 */
export function rateLimit(
  request: NextRequest,
  { windowMs = 60_000, max = 30 }: { windowMs?: number; max?: number } = {},
): NextResponse | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  const route = new URL(request.url).pathname;
  const key = `${ip}:${route}`;

  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count += 1;

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      },
    );
  }

  return null;
}

/* ── Safe error message ──────────────────────────── */

/**
 * Strip internal details from error messages before returning to the client.
 * Keeps known safe prefixes; everything else becomes a generic message.
 */
export function safeError(err: unknown, fallback = 'An unexpected error occurred'): string {
  if (!(err instanceof Error)) return fallback;

  const msg = err.message;

  // Allow certain known safe patterns through
  const safePatterns = [
    /^Not authenticated/,
    /^GitHub account not linked/,
    /^Vercel token required/,
    /^No API key configured/,
    /^Project name is required/,
    /^No files provided/,
    /^Token is required/,
    /^Missing/,
    /^Invalid/,
  ];

  if (safePatterns.some((p) => p.test(msg))) {
    return msg;
  }

  return fallback;
}
