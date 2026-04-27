// app/api/subcontracts/[id]/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { canUserDo, currentUserId } from '@/lib/permissions';

async function loadSubAndCheck(id, userId, capability = 'view_subcontracts') {
  const supa = getSupabaseAdmin();
  const { data: sub } = await supa.from('subcontracts').select('*, project:projects!project_id(entity_id)').eq('id', id).single();
  if (!sub) return { error: 'Not found', status: 404 };
  const allowed = await canUserDo(userId, capability, {
    entityId: sub.project.entity_id, module: 'construction'
  });
  if (!allowed) return { error: 'Forbidden', status: 403 };
  return { sub };
}

export async function GET(_req, { params }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });
  const result = await loadSubAndCheck(params.id, userId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ subcontract: result.sub });
}

export async function PATCH(request, { params }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });
  const result = await loadSubAndCheck(params.id, userId, 'edit_subcontract');
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

  const body = await request.json();
  const fields = ['scope','contract_value','retainage_pct','amount_paid','amount_retained','status','contract_signed_date','company_id','contact_id','notes'];
  const update = {};
  for (const f of fields) if (f in body) update[f] = body[f];

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('subcontracts')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subcontract: data });
}

export async function DELETE(_req, { params }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });
  const result = await loadSubAndCheck(params.id, userId, 'edit_subcontract');
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });

  const supa = getSupabaseAdmin();
  const { error } = await supa.from('subcontracts').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
