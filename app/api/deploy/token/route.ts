import { NextRequest, NextResponse } from 'next/server';
import { getVercelToken, saveVercelToken, getVercelProjectId } from '@/lib/vercel-server';
import { requireAuth, checkCsrf, rateLimit, safeError } from '@/lib/api-auth';

/**
 * GET /api/deploy/token
 * Returns whether the authenticated user has a Vercel token stored.
 */
export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { windowMs: 60_000, max: 30 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  try {
    const token = await getVercelToken();
    const projectId = await getVercelProjectId();

    return NextResponse.json({
      hasToken: !!token,
      projectId: projectId || null,
    });
  } catch {
    return NextResponse.json({ hasToken: false, projectId: null });
  }
}

/**
 * PUT /api/deploy/token
 * Saves a Vercel token for the authenticated user.
 */
export async function PUT(request: NextRequest) {
  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(request, { windowMs: 60_000, max: 10 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    await saveVercelToken(token.trim());

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: safeError(error, 'Failed to save token') },
      { status: 500 },
    );
  }
}
