import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/** Allowlisted internal redirect paths after auth. */
const ALLOWED_NEXT_PATHS = ['/app', '/landing', '/'];

function sanitizeNext(raw: string | null): string {
  if (!raw) return '/app';
  // Must be a relative path starting with / and NOT starting with //
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/app';
  // Only allow known safe prefixes
  if (ALLOWED_NEXT_PATHS.some((p) => raw === p || raw.startsWith(p + '/'))) {
    return raw;
  }
  return '/app';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = sanitizeNext(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth/callback] Exchange failed:', error?.message);
    return NextResponse.redirect(`${origin}/?auth_error=exchange_failed`);
  }

  // If the user signed in with GitHub, store the provider_token in the background
  // (non-blocking — don't delay the redirect)
  const session = data.session;
  if (session.provider_token) {
    const admin = createAdminClient();
    admin.from('user_secrets').upsert(
      {
        user_id: session.user.id,
        github_token: session.provider_token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    ).then(({ error }) => {
      if (error) console.error('[auth/callback] Failed to store provider_token:', error.message);
    });
  }

  return NextResponse.redirect(`${origin}${next}`);
}
