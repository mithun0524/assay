import { NextRequest, NextResponse } from 'next/server';
import { getGitHubUser } from '@/lib/github-server';
import { requireAuth, rateLimit, safeError } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { windowMs: 60_000, max: 30 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  try {
    const githubUser = await getGitHubUser();
    return NextResponse.json(githubUser);
  } catch (err) {
    const msg = err instanceof Error && err.message?.includes('not linked')
      ? 'GitHub account not linked'
      : safeError(err, 'Failed to get GitHub user');
    const status = msg.includes('not linked') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
