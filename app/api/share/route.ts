import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_FILES = 500;
const MAX_FILE_BYTES = 1_000_000;      // 1 MB per file
const MAX_TOTAL_BYTES = 10_000_000;    // 10 MB per share

/**
 * POST /api/share — Create a shared project snapshot
 * Body: { name: string, files: Record<string, { content: string; language: string }> }
 * Returns: { id: string, url: string }
 */
export async function POST(req: NextRequest) {
  const csrfBlock = checkCsrf(req);
  if (csrfBlock) return csrfBlock;

  const rl = rateLimit(req, { windowMs: 60_000, max: 10 });
  if (rl) return rl;

  const { user, error: authErr } = await requireAuth();
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { name, files } = body;

    if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const entries = Object.entries(files);
    if (entries.length > MAX_FILES) {
      return NextResponse.json({ error: `Too many files (max ${MAX_FILES})` }, { status: 400 });
    }

    // Validate file entries have content, and cap the payload — this lands in a
    // JSONB column, so an unbounded body is a free way to fill the database.
    let totalBytes = 0;
    for (const [path, entry] of entries) {
      const content = (entry as { content?: unknown } | null)?.content;
      if (typeof content !== 'string') {
        return NextResponse.json({ error: `Invalid file entry: ${path}` }, { status: 400 });
      }
      if (content.length > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `File too large: ${path} (max 1 MB)` }, { status: 400 });
      }
      totalBytes += content.length;
      if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json({ error: 'Project too large to share (max 10 MB)' }, { status: 413 });
      }
    }

    if (name !== undefined && (typeof name !== 'string' || name.length > 200)) {
      return NextResponse.json({ error: 'Invalid project name' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const supabase = await createClient();

    // Store files as JSONB in shared_projects table
    const { error } = await supabase.from('shared_projects').insert({
      id,
      user_id: user.id,
      name: (name as string | undefined)?.trim() || 'Untitled Project',
      files,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to share project:', error);
      return NextResponse.json({ error: 'Failed to share project' }, { status: 500 });
    }

    // Never build the link from the client-supplied Origin header.
    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const shareUrl = `${origin.replace(/\/$/, '')}/s/${id}`;

    return NextResponse.json({ id, url: shareUrl });
  } catch (err) {
    console.error('Share error:', err);
    return NextResponse.json({ error: 'Failed to share project' }, { status: 500 });
  }
}

/**
 * GET /api/share?id=<shareId> — Fetch a shared project
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid share ID' }, { status: 400 });
  }

  const rl = rateLimit(req, { windowMs: 60_000, max: 30 });
  if (rl) return rl;

  try {
    // Read with the service-role client and scope it to this one id.
    // The table itself is no longer readable by anon — it used to be
    // `FOR SELECT USING (true)`, which made every share enumerable by
    // anyone holding the (public) anon key. The unguessable id is the
    // capability; this route is the only way to spend it.
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('shared_projects')
      .select('id, name, files, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      files: data.files,
      createdAt: data.created_at,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }
}
