import { NextRequest, NextResponse } from 'next/server';
import { cloneRepository } from '@/lib/github-server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { owner, repo, branch } = await request.json();

  try {
    const files = await cloneRepository(owner, repo, branch);
    return NextResponse.json(files);
  } catch (err: any) {
    const status = err.message?.includes('not linked') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
