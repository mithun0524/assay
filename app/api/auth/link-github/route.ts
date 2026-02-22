import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'github',
    options: {
      scopes: 'repo user:email',
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to initiate GitHub linking' },
      { status: 400 },
    );
  }

  return NextResponse.json({ url: data.url });
}
