import { NextRequest, NextResponse } from 'next/server';
import { listRepositories, createRepository, githubErrorResponse } from '@/lib/github-server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { windowMs: 60_000, max: 30 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const SORTS = ['created', 'updated', 'pushed', 'full_name'] as const;
  const rawSort = searchParams.get('sort');
  const sort = SORTS.find((s) => s === rawSort);
  const per_page = searchParams.get('per_page');

  try {
    const repos = await listRepositories({
      sort,
      per_page: per_page ? Math.min(parseInt(per_page) || 30, 100) : undefined,
    });
    return NextResponse.json(repos);
  } catch (err) {
    return githubErrorResponse(err, 'Failed to list repositories');
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
    return githubErrorResponse(err, 'Failed to create repository');
  }
}
