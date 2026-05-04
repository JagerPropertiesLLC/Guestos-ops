// app/api/field-log/batch-tag/route.js
// POST { photo_ids: [...], tags: { property_id?, unit_id?, project_id?, photo_type?, note? } }
// Applies the same tags to multiple photos at once. Auto-derives resolved_status per row.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['issue', 'progress', 'reference'];

export async function POST(request) {
  const { photo_ids, tags } = await request.json();
  if (!Array.isArray(photo_ids) || photo_ids.length === 0) {
    return NextResponse.json({ error: 'photo_ids must be a non-empty array' }, { status: 400 });
  }
  if (!tags || typeof tags !== 'object') {
    return NextResponse.json({ error: 'tags object required' }, { status: 400 });
  }
  if (tags.photo_type && !VALID_TYPES.includes(tags.photo_type)) {
    return NextResponse.json({ error: `photo_type must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  // Pull existing rows so we can derive the final resolved_status for each.
  const { data: existing } = await supa
    .from('field_log_photos')
    .select('id, property_id, unit_id, project_id, photo_type, note, resolved_status')
    .in('id', photo_ids);

  const updates = (existing || [])
    .filter(p => p.resolved_status !== 'routed')
    .map(p => {
      const next = {
        property_id: 'property_id' in tags ? tags.property_id : p.property_id,
        unit_id:     'unit_id'     in tags ? tags.unit_id     : p.unit_id,
        project_id:  'project_id'  in tags ? tags.project_id  : p.project_id,
        photo_type:  'photo_type'  in tags ? tags.photo_type  : p.photo_type,
        note:        'note'        in tags ? tags.note        : p.note
      };
      const hasParent = !!(next.property_id || next.project_id);
      const hasType = VALID_TYPES.includes(next.photo_type);
      next.resolved_status = hasParent && hasType ? 'tagged' : 'untagged';
      return { id: p.id, ...next };
    });

  // Run updates sequentially; small batch so it's fine without a Postgres function.
  const results = [];
  for (const u of updates) {
    const { id, ...patch } = u;
    const { data, error } = await supa.from('field_log_photos').update(patch).eq('id', id).select().single();
    if (error) results.push({ id, error: error.message });
    else results.push({ id, ok: true, resolved_status: data.resolved_status });
  }

  return NextResponse.json({ updated: results.length, results });
}
