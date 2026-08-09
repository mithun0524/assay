import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { windowMs: 60_000, max: 30 });
  if (rl) return rl;

  const { user, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const supabase = await createClient();
  const { data: secrets } = await supabase
    .from('user_secrets')
    .select('github_token, openrouter_key, vercel_token')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    hasGithubToken: !!secrets?.github_token,
    hasOpenrouterKey: !!secrets?.openrouter_key,
    // Only return a masked hint — never the full key
    // Masked hint only — enough to recognise the key, never enough to use it.
    openrouterKeyHint: secrets?.openrouter_key
      ? `${secrets.openrouter_key.slice(0, 6)}...${secrets.openrouter_key.slice(-4)}`
      : null,
    hasVercelToken: !!secrets?.vercel_token,
  });
}

export async function PUT(request: NextRequest) {
  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(request, { windowMs: 60_000, max: 10 });
  if (rl) return rl;

  const { user, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { openrouterKey, vercelToken } = await request.json();

  const updateData: Record<string, unknown> = {
    user_id: user.id,
    updated_at: new Date().toISOString(),
  };

  const MAX_SECRET_LEN = 300;

  if (openrouterKey !== undefined) {
    if (openrouterKey && (typeof openrouterKey !== 'string' || openrouterKey.length > MAX_SECRET_LEN)) {
      return NextResponse.json({ error: 'Invalid API key format' }, { status: 400 });
    }
    updateData.openrouter_key = openrouterKey ? openrouterKey.trim() : null;
  }
  if (vercelToken !== undefined) {
    if (vercelToken && (typeof vercelToken !== 'string' || vercelToken.length > MAX_SECRET_LEN)) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }
    updateData.vercel_token = vercelToken ? vercelToken.trim() : null;
  }

  if (openrouterKey === undefined && vercelToken === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('user_secrets').upsert(
    updateData,
    { onConflict: 'user_id' }
  );

  if (error) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
