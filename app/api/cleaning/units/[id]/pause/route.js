// app/api/cleaning/units/[id]/pause/route.js
//
// POST /api/cleaning/units/:id/pause
// Body: { reason? }
// Pauses an in-flight cleaning. Opens a cleaning_pause_windows row and flips
// unit_status='paused'. Idempotent against an already-paused unit.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { id } = params;
  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const reason = body.reason || null;

  const supa = getSupabaseAdmin();

  const { data: row } = await supa
    .from('schedule_units')
    .select('id, unit_status')
    .eq('id', id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'schedule_unit not found' }, { status: 404 });
  if (row.unit_status !== 'cleaning') {
    return NextResponse.json({
      error: `cannot pause from unit_status=${row.unit_status}`,
      hint: 'unit must be in unit_status=cleaning to pause'
    }, { status: 400 });
  }

  // Close any stray open windows before opening a new one (defensive).
  await supa
    .from('cleaning_pause_windows')
    .update({ resumed_at: new Date().toISOString() })
    .eq('schedule_unit_id', id)
    .is('resumed_at', null);

  const { error: pErr } = await supa
    .from('cleaning_pause_windows')
    .insert({ schedule_unit_id: id, pause_reason: reason });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  const { data, error } = await supa
    .from('schedule_units')
    .update({ unit_status: 'paused' })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, schedule_unit: data });
}
