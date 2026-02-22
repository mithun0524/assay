import { NextRequest, NextResponse } from 'next/server';
import {
  getVercelToken,
  createDeployment,
  saveVercelProjectId,
} from '@/lib/vercel-server';
import { sanitizeProjectName } from '@/lib/deploy';
import type { FrameworkType } from '@/lib/deploy';
import { requireAuth, checkCsrf, rateLimit, safeError } from '@/lib/api-auth';

/**
 * POST /api/deploy
 * Creates a Vercel deployment from uploaded files.
 */
export async function POST(request: NextRequest) {
  // ── Security guards ──
  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(request, { windowMs: 60_000, max: 10 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { files, projectName, framework, projectId } = body;

    if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (!projectName) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const resolvedToken = await getVercelToken();
    if (!resolvedToken) {
      return NextResponse.json(
        { error: 'Vercel token required. Please add your token first.' },
        { status: 403 }
      );
    }

    const sanitizedName = sanitizeProjectName(projectName);

    const result = await createDeployment(
      files,
      sanitizedName,
      (framework as FrameworkType) || null,
      resolvedToken,
      projectId || undefined
    );

    if (result.projectId) {
      await saveVercelProjectId(result.projectId).catch(() => {});
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: safeError(error, 'Deployment failed') },
      { status: 500 },
    );
  }
}
