// app/api/cleaning/units/[id]/complete/route.js
//
// POST /api/cleaning/units/:id/complete
// Stamps stopped_at, flips unit_status='complete' + status='done', closes any
// stray open pause window. Returns elapsed_seconds (excluding pause time)
// for reporting.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(_request, { params }) {
  const { id } = params;
  const supa = getSupabaseAdmin();

  const { data: row } = await supa
    .from('schedule_units')
    .select('id, unit_status, started_at')
    .eq('id', id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'schedule_unit not found' }, { status: 404 });
  if (row.unit_status === 'complete') {
    return NextResponse.json({ ok: true, schedule_unit: row, no_op: true });
  }

  const stoppedAt = new Date();

  // Close any open pause window first so elapsed math is accurate.
  await supa
    .from('cleaning_pause_windows')
    .update({ resumed_at: stoppedAt.toISOString() })
    .eq('schedule_unit_id', id)
    .is('resumed_at', null);

  const { data, error } = await supa
    .from('schedule_units')
    .update({
      unit_status: 'complete',
      status: 'done',
      stopped_at: stoppedAt.toISOString(),
      completed_at: stoppedAt.toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute elapsed seconds (working time, excluding pauses).
  let elapsedSeconds = null;
  if (data.started_at) {
    const startedMs = new Date(data.started_at).getTime();
    const stoppedMs = stoppedAt.getTime();
    const { data: windows } = await supa
      .from('cleaning_pause_windows')
      .select('paused_at, resumed_at')
      .eq('schedule_unit_id', id);
    let pausedMs = 0;
    for (const w of windows || []) {
      if (!w.paused_at || !w.resumed_at) continue;
      pausedMs += new Date(w.resumed_at).getTime() - new Date(w.paused_at).getTime();
    }
    elapsedSeconds = Math.max(0, Math.round((stoppedMs - startedMs - pausedMs) / 1000));
  }

  return NextResponse.json({ ok: true, schedule_unit: data, elapsed_seconds: elapsedSeconds });
}
