// app/api/inspections/units/[id]/route.js
//
// GET    /api/inspections/units/:id   — full detail (inspection + findings + photos)
// PATCH  /api/inspections/units/:id   — update fields
//   { damage_summary?, review_notes?, status?, guest_name?, checkout_date? }
//   Status transitions: in_progress → submitted (Sam), submitted → reviewed (Judson),
//   reviewed → closed (Judson). Setting status='submitted' stamps completed_at.
//   Setting status in ('reviewed','closed') stamps reviewed_by + reviewed_at.
// DELETE /api/inspections/units/:id   — cascade-deletes findings; photos linked
//   via documents.parent_type='unit_inspection' are NOT auto-purged (admin can
//   remove them via /api/documents/[id]).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { currentCallerId } from '@/lib/orgContext';
import { signedUrlFor } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUS = ['in_progress', 'submitted', 'reviewed', 'closed'];

export async function GET(_request, { params }) {
  const { id } = params;
  const supa = getSupabaseAdmin();

  const { data: ins, error } = await supa
    .from('unit_inspections')
    .select(`
      id, unit_id, property_id, reservation_id, schedule_unit_id,
      inspected_by, started_at, completed_at, status,
      guest_name, checkout_date, damage_summary, review_notes,
      reviewed_by, reviewed_at, created_at, updated_at,
      properties:property_id ( id, short_name, full_address ),
      units:unit_id ( id, unit_label, bedrooms, bathrooms ),
      reservations:reservation_id ( id, channel, arrival_date, departure_date, nights, total_price ),
      inspector:app_users!inspected_by ( id, full_name, email ),
      reviewer:app_users!reviewed_by ( id, full_name, email )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!ins) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: findings } = await supa
    .from('inspection_findings')
    .select('*')
    .eq('inspection_id', id)
    .order('created_at', { ascending: true });

  // Photos: docs attached to the inspection itself + each finding.
  const findingIds = (findings || []).map(f => f.id);
  const parentIds = [id, ...findingIds];
  const { data: docs } = await supa
    .from('documents')
    .select('id, parent_type, parent_id, title, description, mime_type, storage_bucket, storage_path, created_at, uploaded_by')
    .in('parent_type', ['unit_inspection', 'inspection_finding'])
    .in('parent_id', parentIds)
    .order('created_at', { ascending: true });

  const enrichedDocs = await Promise.all((docs || []).map(async (d) => {
    let download_url = null;
    if (d.storage_bucket && d.storage_path) {
      download_url = await signedUrlFor(d.storage_bucket, d.storage_path);
    }
    return { ...d, download_url };
  }));

  const photosByInspection = enrichedDocs.filter(d => d.parent_type === 'unit_inspection' && d.parent_id === id);
  const photosByFinding = {};
  for (const d of enrichedDocs.filter(d => d.parent_type === 'inspection_finding')) {
    if (!photosByFinding[d.parent_id]) photosByFinding[d.parent_id] = [];
    photosByFinding[d.parent_id].push(d);
  }

  const enrichedFindings = (findings || []).map(f => ({
    ...f,
    photos: photosByFinding[f.id] || []
  }));

  return NextResponse.json({
    inspection: ins,
    findings: enrichedFindings,
    photos: photosByInspection
  });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  const body = await request.json();
  const supa = getSupabaseAdmin();
  const callerId = await currentCallerId();

  const update = {};
  if (typeof body.damage_summary === 'string' || body.damage_summary === null) update.damage_summary = body.damage_summary;
  if (typeof body.review_notes === 'string'   || body.review_notes === null)   update.review_notes = body.review_notes;
  if (typeof body.guest_name === 'string'     || body.guest_name === null)     update.guest_name = body.guest_name;
  if (typeof body.checkout_date === 'string'  || body.checkout_date === null)  update.checkout_date = body.checkout_date;

  if (body.status) {
    if (!ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: `invalid status: ${body.status}` }, { status: 400 });
    }
    update.status = body.status;
    if (body.status === 'submitted') update.completed_at = new Date().toISOString();
    if (body.status === 'reviewed' || body.status === 'closed') {
      update.reviewed_by = callerId;
      update.reviewed_at = new Date().toISOString();
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const { data, error } = await supa
    .from('unit_inspections')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inspection: data });
}

export async function DELETE(_request, { params }) {
  const { id } = params;
  const supa = getSupabaseAdmin();
  const { error } = await supa.from('unit_inspections').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
