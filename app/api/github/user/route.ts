import { NextRequest, NextResponse } from 'next/server';
import { getGitHubUser, githubErrorResponse } from '@/lib/github-server';
import { requireAuth, rateLimit } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { windowMs: 60_000, max: 30 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  try {
    const githubUser = await getGitHubUser();
    return NextResponse.json(githubUser);
  } catch (err) {
    return githubErrorResponse(err, 'Failed to get GitHub user');
  }
}
