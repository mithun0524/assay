import { NextRequest, NextResponse } from 'next/server';
import { getVercelToken, getDeploymentStatus } from '@/lib/vercel-server';
import { requireAuth, rateLimit, safeError } from '@/lib/api-auth';

/** Vercel deployment IDs are alphanumeric with optional underscores/hyphens. */
const DEPLOYMENT_ID_RE = /^[a-zA-Z0-9_-]{1,100}$/;

/**
 * GET /api/deploy/status?id=xxx
 * Polls a Vercel deployment status.
 */
export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { windowMs: 60_000, max: 60 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  try {
    const { searchParams } = new URL(request.url);
    const deploymentId = searchParams.get('id');

    if (!deploymentId) {
      return NextResponse.json({ error: 'Deployment ID is required' }, { status: 400 });
    }

    if (!DEPLOYMENT_ID_RE.test(deploymentId)) {
      return NextResponse.json({ error: 'Invalid deployment ID' }, { status: 400 });
    }

    const resolvedToken = await getVercelToken();
    if (!resolvedToken) {
      return NextResponse.json({ error: 'Vercel token required' }, { status: 403 });
    }

    const status = await getDeploymentStatus(deploymentId, resolvedToken);

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: safeError(error, 'Failed to check deployment status') },
      { status: 500 },
    );
  }
}
