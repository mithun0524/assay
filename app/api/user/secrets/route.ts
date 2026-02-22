import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: secrets } = await supabase
    .from('user_secrets')
    .select('github_token, openrouter_key')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    hasGithubToken: !!secrets?.github_token,
    hasOpenrouterKey: !!secrets?.openrouter_key,
    openrouterKey: secrets?.openrouter_key || null,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { openrouterKey } = await request.json();

  const { error } = await supabase.from('user_secrets').upsert(
    {
      user_id: user.id,
      openrouter_key: openrouterKey || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
