// app/api/inspections/units/route.js
//
// GET  /api/inspections/units                     — list inspections (filterable)
//   ?status=in_progress|submitted|reviewed|closed
//   ?property_id=X | ?unit_id=Y
//   ?limit=N (default 50)
// POST /api/inspections/units                     — create inspection
//   { unit_id?, schedule_unit_id?, reservation_id?, guest_name?, checkout_date? }
//   Either unit_id or schedule_unit_id is required.
//   When schedule_unit_id is provided, we resolve unit_id + property_id from the
//   schedule_units row (using property_name + unit_number to look up the unit).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSingletonOrgId, currentCallerId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

async function resolveUnitFromScheduleUnit(supa, scheduleUnitId) {
  const { data: su } = await supa
    .from('schedule_units')
    .select('id, property_name, unit_number, guest_name, checkout_time, schedule_id, cleaning_schedules:schedule_id ( date )')
    .eq('id', scheduleUnitId)
    .maybeSingle();
  if (!su) return null;

  // First try direct unit_id column (Phase 7b will populate this).
  // Falls through to text-match resolver if not present.
  if (su.unit_id) return { ...su, unit_id: su.unit_id };

  // Resolve via property short_name + unit label.
  const { data: prop } = await supa
    .from('properties')
    .select('id')
    .eq('short_name', su.property_name)
    .maybeSingle();
  if (!prop) return { ...su, _propMatchFailed: true };

  let unitQuery = supa.from('units').select('id, unit_label').eq('property_id', prop.id);
  if (su.unit_number) {
    // Try exact match on unit_label first (e.g. "APT 101").
    const { data: exact } = await unitQuery.eq('unit_label', su.unit_number).maybeSingle();
    if (exact) return { ...su, unit_id: exact.id, property_id: prop.id };
    // Try ILIKE on unit_label (e.g. unit_number "101" matching "APT 101").
    const { data: like } = await supa
      .from('units')
      .select('id, unit_label')
      .eq('property_id', prop.id)
      .ilike('unit_label', `%${su.unit_number}%`)
      .limit(1)
      .maybeSingle();
    if (like) return { ...su, unit_id: like.id, property_id: prop.id };
  }
  // Single-unit property fallback.
  const { data: only } = await supa.from('units').select('id').eq('property_id', prop.id).limit(2);
  if (only?.length === 1) return { ...su, unit_id: only[0].id, property_id: prop.id };
  return { ...su, property_id: prop.id, _unitMatchFailed: true };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const propertyId = searchParams.get('property_id');
  const unitId = searchParams.get('unit_id');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  const supa = getSupabaseAdmin();
  let q = supa
    .from('unit_inspections')
    .select(`
      id, unit_id, property_id, reservation_id, schedule_unit_id,
      inspected_by, started_at, completed_at, status,
      guest_name, checkout_date, damage_summary, review_notes,
      reviewed_by, reviewed_at, created_at, updated_at,
      properties:property_id ( short_name, full_address ),
      units:unit_id ( unit_label ),
      inspector:app_users!inspected_by ( id, full_name, email ),
      reviewer:app_users!reviewed_by ( id, full_name, email )
    `)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (status) q = q.eq('status', status);
  if (propertyId) q = q.eq('property_id', propertyId);
  if (unitId) q = q.eq('unit_id', unitId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lightweight finding counts per inspection.
  const ids = (data || []).map(r => r.id);
  let countsById = {};
  if (ids.length > 0) {
    const { data: counts } = await supa
      .from('inspection_findings')
      .select('inspection_id')
      .in('inspection_id', ids);
    for (const row of counts || []) {
      countsById[row.inspection_id] = (countsById[row.inspection_id] || 0) + 1;
    }
  }

  const enriched = (data || []).map(r => ({ ...r, finding_count: countsById[r.id] || 0 }));
  return NextResponse.json({ inspections: enriched });
}

export async function POST(request) {
  const body = await request.json();
  const { unit_id, schedule_unit_id, reservation_id, guest_name, checkout_date } = body;

  if (!unit_id && !schedule_unit_id) {
    return NextResponse.json({ error: 'unit_id or schedule_unit_id required' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const orgId = await getSingletonOrgId();
  const callerId = await currentCallerId();

  let resolvedUnitId = unit_id || null;
  let resolvedPropertyId = null;
  let resolvedReservationId = reservation_id || null;
  let resolvedGuestName = guest_name || null;
  let resolvedCheckoutDate = checkout_date || null;

  if (schedule_unit_id) {
    const su = await resolveUnitFromScheduleUnit(supa, schedule_unit_id);
    if (!su) return NextResponse.json({ error: 'schedule_unit not found' }, { status: 404 });
    if (!resolvedUnitId) resolvedUnitId = su.unit_id || null;
    if (!resolvedPropertyId) resolvedPropertyId = su.property_id || null;
    if (!resolvedGuestName && su.guest_name) resolvedGuestName = su.guest_name;
    if (!resolvedCheckoutDate && su.cleaning_schedules?.date) resolvedCheckoutDate = su.cleaning_schedules.date;
    if (!resolvedUnitId) {
      return NextResponse.json({
        error: 'could not resolve unit from schedule_unit',
        hint: 'pass unit_id explicitly or check property_name/unit_number on the schedule row'
      }, { status: 400 });
    }
  }

  if (!resolvedPropertyId) {
    const { data: u } = await supa.from('units').select('property_id').eq('id', resolvedUnitId).maybeSingle();
    if (!u) return NextResponse.json({ error: 'unit not found' }, { status: 404 });
    resolvedPropertyId = u.property_id;
  }

  // If reservation_id wasn't passed, best-effort: most recent reservation for this unit
  // whose departure_date <= today and not cancelled.
  if (!resolvedReservationId) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: recent } = await supa
      .from('reservations')
      .select('id, guest_id, departure_date')
      .eq('unit_id', resolvedUnitId)
      .lte('departure_date', today)
      .not('status', 'in', '("cancelled","expired","inquiryNotPossible")')
      .order('departure_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      resolvedReservationId = recent.id;
      if (!resolvedCheckoutDate) resolvedCheckoutDate = recent.departure_date;
    }
  }

  const { data: ins, error } = await supa
    .from('unit_inspections')
    .insert({
      org_id: orgId,
      unit_id: resolvedUnitId,
      property_id: resolvedPropertyId,
      reservation_id: resolvedReservationId,
      schedule_unit_id: schedule_unit_id || null,
      inspected_by: callerId,
      guest_name: resolvedGuestName,
      checkout_date: resolvedCheckoutDate,
      status: 'in_progress'
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inspection: ins });
}
