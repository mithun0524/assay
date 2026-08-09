import { NextRequest, NextResponse } from 'next/server';
import { pushToRepository, githubErrorResponse } from '@/lib/github-server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';

const SAFE_NAME = /^[a-zA-Z0-9._-]{1,100}$/;
const MAX_FILES = 500;
const MAX_FILE_SIZE = 1_000_000; // 1 MB per file

export async function POST(request: NextRequest) {
  const csrfBlock = checkCsrf(request);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(request, { windowMs: 60_000, max: 10 });
  if (rl) return rl;

  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { owner, repo, files, commitMessage, branch } = await request.json();

  // ── Input validation ──
  if (!owner || !SAFE_NAME.test(owner)) {
    return NextResponse.json({ error: 'Invalid owner' }, { status: 400 });
  }
  if (!repo || !SAFE_NAME.test(repo)) {
    return NextResponse.json({ error: 'Invalid repository name' }, { status: 400 });
  }
  if (branch && !SAFE_NAME.test(branch)) {
    return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 });
  }
  if (!files || typeof files !== 'object') {
    return NextResponse.json({ error: 'Files are required' }, { status: 400 });
  }

  const fileEntries = Object.entries(files);
  if (fileEntries.length === 0) {
    return NextResponse.json({ error: 'No files to push' }, { status: 400 });
  }
  if (fileEntries.length > MAX_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 });
  }
  for (const [, entry] of fileEntries) {
    const content = (entry as { content?: unknown } | null)?.content;
    if (typeof content === 'string' && content.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 1 MB per file)' }, { status: 400 });
    }
  }

  if (!commitMessage || typeof commitMessage !== 'string' || commitMessage.length > 500) {
    return NextResponse.json({ error: 'Invalid commit message' }, { status: 400 });
  }

  try {
    await pushToRepository(owner, repo, files, commitMessage, branch);
    return NextResponse.json({ success: true });
  } catch (err) {
    return githubErrorResponse(err, 'Failed to push to repository');
  }
}
