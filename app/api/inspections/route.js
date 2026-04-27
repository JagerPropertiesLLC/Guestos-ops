// app/api/inspections/route.js
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

  const allowed = await canUserDo(userId, 'view_inspections', {
    entityId: project.entity_id, module: 'construction'
  });
  if (!allowed) return NextResponse.json({ inspections: [], hidden: true });

  const { data, error } = await supa
    .from('inspections')
    .select(`
      id, inspection_type, authority, scheduled_date, completed_date, result,
      failure_notes, followup_required, followup_date, notes,
      inspector_company:companies!inspector_company_id(id, name),
      inspector_contact:contacts!inspector_contact_id(id, first_name, last_name, phone)
    `)
    .eq('project_id', projectId)
    .order('scheduled_date', { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inspections: data });
}

export async function POST(request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await request.json();
  const { project_id, inspection_type, authority, scheduled_date, inspector_company_id, inspector_contact_id, notes } = body;
  if (!project_id || !inspection_type) {
    return NextResponse.json({ error: 'project_id and inspection_type required' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data: project } = await supa.from('projects').select('entity_id').eq('id', project_id).single();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canUserDo(userId, 'schedule_inspections', {
    entityId: project.entity_id, module: 'construction'
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supa
    .from('inspections')
    .insert({
      project_id, inspection_type,
      authority: authority || null,
      scheduled_date: scheduled_date || null,
      inspector_company_id: inspector_company_id || null,
      inspector_contact_id: inspector_contact_id || null,
      notes: notes || null
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inspection: data });
}
