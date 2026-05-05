// app/api/cleaning/active-units/route.js
//
// GET /api/cleaning/active-units
// Returns schedule_units currently in flight (unit_status in cleaning|paused),
// across all of today's schedule. Used by:
//  - field-log unit picker (pin in-progress units to top)
//  - parallel-cleaning dashboard (future)
// Filters: ?date=YYYY-MM-DD (defaults to today).

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');
  const today = dateParam || new Date().toISOString().slice(0, 10);

  const supa = getSupabaseAdmin();

  // Find today's schedule(s).
  const { data: schedules } = await supa
    .from('cleaning_schedules')
    .select('id, date')
    .eq('date', today);
  const scheduleIds = (schedules || []).map(s => s.id);
  if (scheduleIds.length === 0) {
    return NextResponse.json({ active_units: [], date: today });
  }

  const { data, error } = await supa
    .from('schedule_units')
    .select(`
      id, schedule_id, sort_order, property_name, unit_number, guest_name,
      unit_status, started_at, stopped_at, cleaner_id, unit_id, status,
      cleaner:app_users!cleaner_id ( id, full_name, email )
    `)
    .in('schedule_id', scheduleIds)
    .in('unit_status', ['cleaning', 'paused'])
    .order('started_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ active_units: data || [], date: today });
}
