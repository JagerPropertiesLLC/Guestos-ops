// app/api/subcontracts/route.js
// GET  /api/subcontracts?project_id=...  — list subs for a project
// POST /api/subcontracts                 — create new sub

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

  const canSeeList = await canUserDo(userId, 'view_subcontracts', {
    entityId: project.entity_id, module: 'construction'
  });
  if (!canSeeList) return NextResponse.json({ subcontracts: [], hidden: true });

  const canSeeValues = await canUserDo(userId, 'view_subcontract_values', {
    entityId: project.entity_id, module: 'construction'
  });

  const { data, error } = await supa
    .from('subcontracts')
    .select(`
      id, scope, status, contract_signed_date,
      contract_value, retainage_pct, amount_paid, amount_retained,
      company:companies!company_id(id, name),
      contact:contacts!contact_id(id, first_name, last_name)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Strip dollar values if user can't see them
  const subs = data.map((s) =>
    canSeeValues ? s : { ...s, contract_value: null, amount_paid: null, amount_retained: null }
  );

  return NextResponse.json({ subcontracts: subs, redacted: !canSeeValues });
}

export async function POST(request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await request.json();
  const { project_id, scope, contract_value, company_id, contact_id, retainage_pct, contract_signed_date, status, notes } = body;
  if (!project_id || !scope || contract_value === undefined) {
    return NextResponse.json({ error: 'project_id, scope, contract_value required' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();
  const { data: project } = await supa.from('projects').select('entity_id').eq('id', project_id).single();
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const allowed = await canUserDo(userId, 'edit_subcontract', {
    entityId: project.entity_id, module: 'construction'
  });
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supa
    .from('subcontracts')
    .insert({
      project_id, scope,
      contract_value: Number(contract_value),
      company_id: company_id || null,
      contact_id: contact_id || null,
      retainage_pct: retainage_pct ?? 10.0,
      contract_signed_date: contract_signed_date || null,
      status: status || 'active',
      notes: notes || null
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subcontract: data });
}
