// app/api/maintenance/[id]/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function PATCH(request, { params }) {
  const supa = getSupabaseAdmin();
  const body = await request.json();
  const fields = ['status','assigned_to_company_id','assigned_to_contact_id','priority','category','title','description','resolved_at','resolution_notes','cost'];
  const update = {};
  for (const f of fields) if (f in body) update[f] = body[f];
  update.updated_at = new Date().toISOString();

  const { data, error } = await supa
    .from('maintenance_requests')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}

export async function DELETE(_req, { params }) {
  const supa = getSupabaseAdmin();
  const { error } = await supa.from('maintenance_requests').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
