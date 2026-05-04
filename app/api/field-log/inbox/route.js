// app/api/field-log/inbox/route.js
// GET — untagged + partially-tagged photos for the current user, newest first.
// Each photo gets a signed URL for thumbnail rendering.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { signedUrlFor } from '@/lib/storage';
import { currentCallerId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'inbox'; // 'inbox' | 'routed' | 'all'
  const userId = await currentCallerId();

  const supa = getSupabaseAdmin();
  let q = supa.from('field_log_photos')
    .select(`
      id, storage_path, captured_at, captured_lat, captured_lng, captured_by,
      property_id, unit_id, project_id, photo_type, note, resolved_status,
      routed_to_task_id, routed_to_document_id,
      property:properties!property_id ( id, short_name ),
      unit:units!unit_id ( id, unit_label ),
      project:projects!project_id ( id, name )
    `)
    .order('captured_at', { ascending: false })
    .limit(200);

  if (view === 'inbox')  q = q.in('resolved_status', ['untagged', 'tagged']);
  if (view === 'routed') q = q.eq('resolved_status', 'routed');
  if (userId)            q = q.eq('captured_by', userId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const enriched = await Promise.all((data || []).map(async (p) => ({
    ...p,
    thumbnail_url: await signedUrlFor('field-log', p.storage_path)
  })));

  return NextResponse.json({ photos: enriched });
}
