// app/api/scheduler/route.js
// GET /api/scheduler?user_id=...&from=YYYY-MM-DD&to=YYYY-MM-DD
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(request) {
  const supa = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  const from = searchParams.get('from') || new Date().toISOString().slice(0, 10);
  const to   = searchParams.get('to')   || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  let q = supa.from('task_assignments')
    .select(`
      id, source_type, source_id, scheduled_date, scheduled_start_time, estimated_minutes,
      title, status, priority, auto_scheduled,
      property:properties!property_id(id, short_name)
    `)
    .gte('scheduled_date', from).lte('scheduled_date', to)
    .order('scheduled_date', { ascending: true })
    .order('priority', { ascending: true });
  if (userId) q = q.eq('assigned_to_user_id', userId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pull staff availability for the user
  let availability = null;
  if (userId) {
    const { data: avail } = await supa.from('staff_availability').select('*').eq('user_id', userId).maybeSingle();
    availability = avail;
  }

  return NextResponse.json({ assignments: data || [], availability });
}

export const dynamic = 'force-dynamic';
