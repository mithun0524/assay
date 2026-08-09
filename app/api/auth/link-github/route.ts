import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkCsrf, rateLimit } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(request, { windowMs: 60_000, max: 10 });
  if (rl) return rl;

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // NEXT_PUBLIC_APP_URL is often unset in preview deploys — falling back to the
  // request origin keeps the callback from becoming "undefined/api/auth/callback".
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'github',
    options: {
      scopes: 'repo user:email',
      redirectTo: `${appUrl}/api/auth/callback`,
    },
  });

  if (error || !data?.url) {
    console.error('[link-github] linkIdentity failed:', error?.message);
    return NextResponse.json(
      { error: 'Failed to initiate GitHub linking' },
      { status: 400 },
    );
  }

  return NextResponse.json({ url: data.url });
}
