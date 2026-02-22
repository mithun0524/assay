import { NextRequest, NextResponse } from 'next/server';
import { listRepositories, createRepository } from '@/lib/github-server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') as any;
  const per_page = searchParams.get('per_page');

  try {
    const repos = await listRepositories({
      sort: sort || undefined,
      per_page: per_page ? parseInt(per_page) : undefined,
    });
    return NextResponse.json(repos);
  } catch (err: any) {
    const status = err.message?.includes('not linked') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { name, description, isPrivate } = await request.json();

  try {
    const repo = await createRepository(name, description, isPrivate);
    return NextResponse.json(repo);
  } catch (err: any) {
    const status = err.message?.includes('not linked') ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
