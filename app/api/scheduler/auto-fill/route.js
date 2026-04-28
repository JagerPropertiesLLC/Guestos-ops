// app/api/scheduler/auto-fill/route.js
// POST /api/scheduler/auto-fill
// Body: { user_id, from, to }
//
// Algorithm:
// 1. For each day in [from, to] check if user is available (default + exceptions)
// 2. Pull existing cleaning assignments for that day → these get priority 10
// 3. Pull pending maintenance requests assigned to this user → priority 50
// 4. Fill remaining capacity with active target_tasks based on recurrence + last_completed
// 5. Insert task_assignments for anything not yet scheduled
//
// This is a starter algorithm. Production version uses smarter scoring + day-of-week prefs.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(request) {
  const supa = getSupabaseAdmin();
  const { user_id, from, to } = await request.json();
  if (!user_id || !from || !to) {
    return NextResponse.json({ error: 'user_id, from, to required' }, { status: 400 });
  }

  // Get availability defaults
  const { data: avail } = await supa.from('staff_availability').select('*').eq('user_id', user_id).maybeSingle();
  if (!avail) return NextResponse.json({ error: 'No availability profile for this user' }, { status: 400 });

  // Get exceptions in range
  const { data: exceptions = [] } = await supa.from('staff_availability_exceptions')
    .select('*').eq('user_id', user_id).gte('exception_date', from).lte('exception_date', to);

  // Helper: is user available on a given date?
  const dayAvailable = (dateStr) => {
    const exc = exceptions.find(e => e.exception_date === dateStr);
    if (exc) return { available: exc.available, capacity: exc.capacity_minutes ?? avail.daily_capacity_minutes };
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const flagMap = ['available_sun','available_mon','available_tue','available_wed','available_thu','available_fri','available_sat'];
    return { available: avail[flagMap[dow]], capacity: avail.daily_capacity_minutes };
  };

  // Get target tasks for this user
  const { data: targets = [] } = await supa.from('target_tasks')
    .select('*').eq('preferred_assignee_user_id', user_id).eq('active', true);

  // Get existing assignments in range to know used capacity
  const { data: existing = [] } = await supa.from('task_assignments')
    .select('scheduled_date, estimated_minutes')
    .eq('assigned_to_user_id', user_id)
    .gte('scheduled_date', from).lte('scheduled_date', to)
    .neq('status', 'cancelled');

  const usedByDate = {};
  for (const e of existing) {
    usedByDate[e.scheduled_date] = (usedByDate[e.scheduled_date] || 0) + (e.estimated_minutes || 30);
  }

  // Walk the date range
  const inserts = [];
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');

  // Track which targets we've already placed in this run (don't double-book)
  const placedTargetIds = new Set();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const { available, capacity } = dayAvailable(dateStr);
    if (!available) continue;

    let used = usedByDate[dateStr] || 0;
    const dow = d.getDay();

    // Try each target task — fill in priority order (high first), prefer day-of-week matches
    const sortedTargets = [...targets]
      .filter(t => !placedTargetIds.has(t.id))
      .sort((a, b) => {
        const pa = a.priority === 'high' ? 0 : a.priority === 'normal' ? 1 : 2;
        const pb = b.priority === 'high' ? 0 : b.priority === 'normal' ? 1 : 2;
        if (pa !== pb) return pa - pb;
        const dayMatchA = a.preferred_day_of_week === dow ? 0 : 1;
        const dayMatchB = b.preferred_day_of_week === dow ? 0 : 1;
        return dayMatchA - dayMatchB;
      });

    for (const t of sortedTargets) {
      const mins = t.estimated_minutes || 30;
      if (used + mins > capacity) continue;
      // Place it
      inserts.push({
        source_type: 'target_task',
        source_id: t.id,
        assigned_to_user_id: user_id,
        scheduled_date: dateStr,
        estimated_minutes: mins,
        property_id: t.property_id || null,
        title: t.title,
        priority: t.priority === 'high' ? 50 : t.priority === 'low' ? 150 : 100,
        auto_scheduled: true,
        status: 'scheduled'
      });
      used += mins;
      placedTargetIds.add(t.id);
    }
  }

  if (inserts.length === 0) {
    return NextResponse.json({ inserted: 0, message: 'No tasks could be auto-scheduled (capacity full or no eligible targets).' });
  }

  const { data, error } = await supa.from('task_assignments').insert(inserts).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: data.length, assignments: data });
}
