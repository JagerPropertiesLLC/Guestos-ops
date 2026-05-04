// app/api/field-log/capture/route.js
// POST — multipart upload of a field-log photo. Initial tags accepted (any
// subset of property_id, unit_id, project_id, photo_type, note, captured_lat,
// captured_lng, captured_at). resolved_status auto-derived: 'tagged' if both
// (property_id|project_id) and photo_type are present, else 'untagged'.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { uploadToBucket, buildStoragePath } from '@/lib/storage';
import { getSingletonOrgId, currentCallerId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['issue', 'progress', 'reference'];

function deriveResolvedStatus({ property_id, project_id, photo_type }) {
  const hasParent = !!(property_id || project_id);
  const hasType   = VALID_TYPES.includes(photo_type);
  return hasParent && hasType ? 'tagged' : 'untagged';
}

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
  }

  const fd = await request.formData();
  const file = fd.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  const property_id = fd.get('property_id') || null;
  const unit_id     = fd.get('unit_id') || null;
  const project_id  = fd.get('project_id') || null;
  const photo_type  = fd.get('photo_type') || null;
  const note        = fd.get('note') || null;
  const captured_lat = fd.get('captured_lat') || null;
  const captured_lng = fd.get('captured_lng') || null;
  const capturedRaw = fd.get('captured_at');
  const captured_at = capturedRaw ? new Date(capturedRaw).toISOString() : new Date().toISOString();

  if (photo_type && !VALID_TYPES.includes(photo_type)) {
    return NextResponse.json({ error: `photo_type must be one of ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }

  const orgId = await getSingletonOrgId();
  const callerId = await currentCallerId();

  // Upload to field-log bucket.
  const buffer = Buffer.from(await file.arrayBuffer());
  const path = buildStoragePath('captures', file.name);
  try {
    await uploadToBucket('field-log', path, buffer, file.type);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const resolved_status = deriveResolvedStatus({ property_id, project_id, photo_type });

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('field_log_photos')
    .insert({
      org_id: orgId,
      storage_path: path,
      captured_at,
      captured_lat: captured_lat ? Number(captured_lat) : null,
      captured_lng: captured_lng ? Number(captured_lng) : null,
      captured_by: callerId,
      property_id,
      unit_id,
      project_id,
      photo_type,
      note,
      resolved_status
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photo: data });
}
