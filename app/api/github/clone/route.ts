import { NextRequest, NextResponse } from 'next/server';
import { cloneRepository } from '@/lib/github-server';
import { requireAuth, checkCsrf, rateLimit, safeError } from '@/lib/api-auth';

const SAFE_NAME = /^[a-zA-Z0-9._-]{1,100}$/;

export async function POST(request: NextRequest) {
  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(request, { windowMs: 60_000, max: 15 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { owner, repo, branch } = await request.json();

  if (!owner || !SAFE_NAME.test(owner)) {
    return NextResponse.json({ error: 'Invalid owner' }, { status: 400 });
  }
  if (!repo || !SAFE_NAME.test(repo)) {
    return NextResponse.json({ error: 'Invalid repository name' }, { status: 400 });
  }
  if (branch && !SAFE_NAME.test(branch)) {
    return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 });
  }

  try {
    const files = await cloneRepository(owner, repo, branch);
    return NextResponse.json(files);
  } catch (err) {
    const msg = err instanceof Error && err.message?.includes('not linked')
      ? 'GitHub account not linked'
      : safeError(err, 'Failed to clone repository');
    const status = msg.includes('not linked') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
