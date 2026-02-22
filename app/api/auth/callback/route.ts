import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth/callback] Exchange failed:', error?.message);
    return NextResponse.redirect(`${origin}/?auth_error=exchange_failed`);
  }

  // If the user signed in with GitHub, capture the provider_token
  const session = data.session;
  if (session.provider_token) {
    try {
      const admin = createAdminClient();
      await admin.from('user_secrets').upsert(
        {
          user_id: session.user.id,
          github_token: session.provider_token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch (err) {
      console.error('[auth/callback] Failed to store provider_token:', err);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
