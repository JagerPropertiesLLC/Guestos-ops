// app/api/target-tasks/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(request) {
  const supa = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');
  let q = supa.from('target_tasks')
    .select('*, property:properties!property_id(id, short_name)')
    .eq('active', true)
    .order('priority', { ascending: true });
  if (userId) q = q.eq('preferred_assignee_user_id', userId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ targets: data || [] });
}

export async function POST(request) {
  const supa = getSupabaseAdmin();
  const body = await request.json();
  const { title, estimated_minutes, recurrence, preferred_assignee_user_id, priority, module = 'str', property_id, preferred_day_of_week, description } = body;
  if (!title || !preferred_assignee_user_id) {
    return NextResponse.json({ error: 'title and preferred_assignee_user_id required' }, { status: 400 });
  }
  const { data, error } = await supa.from('target_tasks').insert({
    title, estimated_minutes: estimated_minutes || 30,
    recurrence: recurrence || 'monthly',
    preferred_assignee_user_id,
    priority: priority || 'normal',
    module, property_id: property_id || null,
    preferred_day_of_week: preferred_day_of_week ?? null,
    description: description || null
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ target: data });
}

export const dynamic = 'force-dynamic';
