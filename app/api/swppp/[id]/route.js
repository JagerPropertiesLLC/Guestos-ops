// app/api/swppp/[id]/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { canUserDo, currentUserId } from '@/lib/permissions';

export async function PATCH(request, { params }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const supa = getSupabaseAdmin();
  const { data: log } = await supa
    .from('swppp_logs')
    .select('project:projects!project_id(entity_id)')
    .eq('id', params.id)
    .single();
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = await canUserDo(userId, 'add_swppp_entry', {
    entityId: log.project.entity_id, module: 'construction'
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const fields = ['log_type','log_date','rain_amount_inches','inspector_name','bmp_status','findings','corrective_actions','photos_url'];
  const update = {};
  for (const f of fields) if (f in body) update[f] = body[f];

  const { data, error } = await supa
    .from('swppp_logs')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}

export async function DELETE(_req, { params }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const supa = getSupabaseAdmin();
  const { data: log } = await supa
    .from('swppp_logs')
    .select('project:projects!project_id(entity_id)')
    .eq('id', params.id)
    .single();
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allowed = await canUserDo(userId, 'add_swppp_entry', {
    entityId: log.project.entity_id, module: 'construction'
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await supa.from('swppp_logs').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
