// app/api/cleaning/units/[id]/resume/route.js
//
// POST /api/cleaning/units/:id/resume
// Closes the open pause window and flips unit_status back to 'cleaning'.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function POST(_request, { params }) {
  const { id } = params;
  const supa = getSupabaseAdmin();

  const { data: row } = await supa
    .from('schedule_units')
    .select('id, unit_status')
    .eq('id', id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'schedule_unit not found' }, { status: 404 });
  if (row.unit_status !== 'paused') {
    return NextResponse.json({
      error: `cannot resume from unit_status=${row.unit_status}`,
      hint: 'unit must be in unit_status=paused to resume'
    }, { status: 400 });
  }

  await supa
    .from('cleaning_pause_windows')
    .update({ resumed_at: new Date().toISOString() })
    .eq('schedule_unit_id', id)
    .is('resumed_at', null);

  const { data, error } = await supa
    .from('schedule_units')
    .update({ unit_status: 'cleaning' })
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, schedule_unit: data });
}
