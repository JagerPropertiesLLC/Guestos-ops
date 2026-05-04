// app/api/field-log/photos/[id]/route.js
// PATCH — update tags (property/unit/project/photo_type/note). Auto-derives
//          resolved_status. Cannot edit a routed photo.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['issue', 'progress', 'reference'];
const PATCHABLE = ['property_id', 'unit_id', 'project_id', 'photo_type', 'note'];

export async function PATCH(request, { params }) {
  const supa = getSupabaseAdmin();
  const { data: existing } = await supa
    .from('field_log_photos')
    .select('id, resolved_status, property_id, unit_id, project_id, photo_type, note')
    .eq('id', params.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (existing.resolved_status === 'routed') {
    return NextResponse.json({ error: 'photo already routed; cannot edit tags' }, { status: 409 });
  }

  const body = await request.json();
  const next = { ...existing };
  for (const k of PATCHABLE) {
    if (k in body) next[k] = body[k];
  }
  if (next.photo_type && !VALID_TYPES.includes(next.photo_type)) {
    return NextResponse.json({ error: `photo_type must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }

  const hasParent = !!(next.property_id || next.project_id);
  const hasType = VALID_TYPES.includes(next.photo_type);
  next.resolved_status = (hasParent && hasType) ? 'tagged' : 'untagged';

  const update = {
    property_id: next.property_id,
    unit_id: next.unit_id,
    project_id: next.project_id,
    photo_type: next.photo_type,
    note: next.note,
    resolved_status: next.resolved_status
  };

  const { data, error } = await supa
    .from('field_log_photos')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photo: data });
}
