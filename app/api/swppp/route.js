// app/api/swppp/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { canUserDo, currentUserId } from '@/lib/permissions';

export async function GET(request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

  const supa = getSupabaseAdmin();
  const { data: project } = await supa.from('projects').select('entity_id').eq('id', projectId).single();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canUserDo(userId, 'view_swppp_logs', {
    entityId: project.entity_id, module: 'construction'
  });
  if (!allowed) return NextResponse.json({ logs: [], hidden: true });

  const { data, error } = await supa
    .from('swppp_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('log_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data });
}

export async function POST(request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await request.json();
  const { project_id, log_type, log_date, rain_amount_inches, inspector_name, bmp_status, findings, corrective_actions, photos_url } = body;
  if (!project_id || !log_type || !log_date) {
    return NextResponse.json({ error: 'project_id, log_type, log_date required' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data: project } = await supa.from('projects').select('entity_id').eq('id', project_id).single();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canUserDo(userId, 'add_swppp_entry', {
    entityId: project.entity_id, module: 'construction'
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supa
    .from('swppp_logs')
    .insert({
      project_id, log_type, log_date,
      rain_amount_inches: rain_amount_inches ?? null,
      inspector_name: inspector_name || null,
      bmp_status: bmp_status || null,
      findings: findings || null,
      corrective_actions: corrective_actions || null,
      photos_url: photos_url || null
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data });
}
