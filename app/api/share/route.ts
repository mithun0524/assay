import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, checkCsrf, rateLimit } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

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

    if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Validate file entries have content
    for (const [path, entry] of Object.entries(files)) {
      if (!entry || typeof entry !== 'object' || typeof (entry as any).content !== 'string') {
        return NextResponse.json({ error: `Invalid file entry: ${path}` }, { status: 400 });
      }
    }

    const id = crypto.randomUUID();
    const supabase = await createClient();

    // Store files as JSONB in shared_projects table
    const { error } = await supabase.from('shared_projects').insert({
      id,
      user_id: user.id,
      name: name || 'Untitled Project',
      files,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to share project:', error);
      return NextResponse.json({ error: 'Failed to share project' }, { status: 500 });
    }

    const origin = req.headers.get('origin') || req.nextUrl.origin;
    const shareUrl = `${origin}/s/${id}`;

    return NextResponse.json({ id, url: shareUrl });
  } catch (err) {
    console.error('Share error:', err);
    return NextResponse.json({ error: 'Failed to share project' }, { status: 500 });
  }
}

/**
 * GET /api/share?id=<shareId> — Fetch a shared project
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing share ID' }, { status: 400 });
  }

  const rl = rateLimit(req, { windowMs: 60_000, max: 30 });
  if (rl) return rl;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('shared_projects')
      .select('id, name, files, created_at, user_id')
      .eq('id', id)
      .single();

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
