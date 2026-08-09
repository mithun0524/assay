import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Coarse pre-auth throttle. The per-route limiter only runs after this file
 * has already called Supabase, so an unauthenticated flood used to cost one
 * auth lookup per request. This stops it at the door.
 * Next's own docs warn that proxy code may run outside the app runtime and be
 * deployed to a CDN, so globals here are per-instance and best-effort only.
 * ponytail: swap for Upstash/Redis the moment you run more than one instance.
 */
const HITS = new Map<string, { n: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_API_HITS = 120;
// Rotating X-Forwarded-For defeats any per-IP limit, so cap total unauthenticated
// API volume as well. Sized to be invisible to real users, fatal to a flood.
const MAX_GLOBAL_HITS = 2_000;
let globalHits = { n: 0, resetAt: 0 };

function clientKey(request: NextRequest): string {
  // Platform-set headers first: a proxy overwrites them, so they cannot be
  // forged. X-Forwarded-For is client-appendable — take the LAST hop, which is
  // whatever the closest trusted proxy added, never the attacker's first entry.
  const hops = request.headers.get('x-forwarded-for')?.split(',').map((v) => v.trim()).filter(Boolean) ?? [];
  return (
    request.headers.get('x-vercel-forwarded-for')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    hops[hops.length - 1] ||
    'unknown'
  );
}

function throttled(request: NextRequest): boolean {
  const now = Date.now();

  if (globalHits.resetAt <= now) globalHits = { n: 0, resetAt: now + WINDOW_MS };
  globalHits.n += 1;
  if (globalHits.n > MAX_GLOBAL_HITS) return true;

  if (HITS.size > 10_000) {
    for (const [k, v] of HITS) if (v.resetAt <= now) HITS.delete(k);
  }

  const key = clientKey(request);
  const entry = HITS.get(key);
  if (!entry || entry.resetAt <= now) {
    HITS.set(key, { n: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.n += 1;
  return entry.n > MAX_API_HITS;
}

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/') && throttled(request)) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  // Supabase falls back to the project's Site URL when the requested redirect
  // isn't allow-listed, dropping the user on "/?code=..." where nothing
  // exchanges the code. Forward it to the callback wherever it lands.
  const authCode = request.nextUrl.searchParams.get('code');
  if (authCode && !request.nextUrl.pathname.startsWith('/api/auth/callback')) {
    const callback = request.nextUrl.clone();
    callback.pathname = '/api/auth/callback';
    return NextResponse.redirect(callback);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured, pass through
  if (!url || !key) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this keeps the auth cookie alive
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes — accessible without auth.
  // Shared project links (/s/<id> and the GET that hydrates them) must stay
  // public, otherwise every shared link bounces visitors to the landing page.
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/landing' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/s/') ||
    (pathname === '/api/share' && request.method === 'GET');

  // Unauthenticated users can only access public routes.
  if (!user && !isPublicRoute) {
    // API clients need a status they can act on. Redirecting a fetch() to an
    // HTML page made every route look like it "succeeded" with garbage.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const landingUrl = request.nextUrl.clone();
    landingUrl.pathname = '/';
    return NextResponse.redirect(landingUrl);
  }

  // Authenticated users on login page — send to app
  if (user && pathname === '/login') {
    const appUrl = request.nextUrl.clone();
    appUrl.pathname = '/app';
    return NextResponse.redirect(appUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
