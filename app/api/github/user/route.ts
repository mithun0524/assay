import { NextResponse } from 'next/server';
import { getGitHubUser } from '@/lib/github-server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const githubUser = await getGitHubUser();
    return NextResponse.json(githubUser);
  } catch (err: any) {
    const status = err.message?.includes('not linked') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
