import { NextRequest, NextResponse } from 'next/server';
import { listRepositories, createRepository } from '@/lib/github-server';
import { requireAuth, checkCsrf, rateLimit, safeError } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { windowMs: 60_000, max: 30 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const sort = searchParams.get('sort') as any;
  const per_page = searchParams.get('per_page');

  try {
    const repos = await listRepositories({
      sort: sort || undefined,
      per_page: per_page ? Math.min(parseInt(per_page) || 30, 100) : undefined,
    });
    return NextResponse.json(repos);
  } catch (err) {
    const msg = err instanceof Error && err.message?.includes('not linked')
      ? 'GitHub account not linked'
      : safeError(err, 'Failed to list repositories');
    const status = msg.includes('not linked') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest) {
  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(request, { windowMs: 60_000, max: 10 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { name, description, isPrivate } = await request.json();

  if (!name || typeof name !== 'string' || name.length > 100) {
    return NextResponse.json({ error: 'Invalid repository name' }, { status: 400 });
  }
  if (description && (typeof description !== 'string' || description.length > 500)) {
    return NextResponse.json({ error: 'Invalid description' }, { status: 400 });
  }

  try {
    const repo = await createRepository(name, description, isPrivate);
    return NextResponse.json(repo);
  } catch (err) {
    const msg = err instanceof Error && err.message?.includes('not linked')
      ? 'GitHub account not linked'
      : safeError(err, 'Failed to create repository');
    const status = msg.includes('not linked') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
