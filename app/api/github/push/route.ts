import { NextRequest, NextResponse } from 'next/server';
import { pushToRepository } from '@/lib/github-server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { owner, repo, files, commitMessage, branch } = await request.json();

  try {
    await pushToRepository(owner, repo, files, commitMessage, branch);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    const status = err.message?.includes('not linked') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
