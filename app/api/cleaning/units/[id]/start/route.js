// app/api/cleaning/units/[id]/start/route.js
//
// POST /api/cleaning/units/:id/start
// Sam clicks "Start" on a schedule_unit. Marks the row in flight, stamps
// started_at + cleaner_id, sets unit_status='cleaning'. Also bumps the legacy
// status='in_progress' so the existing kanban view stays in sync.
// Idempotent: if already 'cleaning', returns the current state without
// resetting started_at.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { currentCallerId } from '@/lib/orgContext';

export const dynamic = 'force-dynamic';

export async function POST(_request, { params }) {
  const { id } = params;
  const supa = getSupabaseAdmin();
  const callerId = await currentCallerId();

  const { data: row, error: rErr } = await supa
    .from('schedule_units')
    .select('id, unit_status, started_at')
    .eq('id', id)
    .maybeSingle();
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'schedule_unit not found' }, { status: 404 });

  if (row.unit_status === 'cleaning') {
    return NextResponse.json({ ok: true, schedule_unit: row, no_op: true });
  }

  const update = {
    unit_status: 'cleaning',
    cleaner_id: callerId,
    status: 'in_progress'
  };
  if (!row.started_at) update.started_at = new Date().toISOString();

  const { data, error } = await supa
    .from('schedule_units')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, schedule_unit: data });
}
