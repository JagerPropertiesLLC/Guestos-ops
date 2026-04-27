// app/api/companies/[id]/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { currentUserId } from '@/lib/permissions';

export async function PATCH(request, { params }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await request.json();
  const fields = ['name','type','primary_market_id','multi_market','phone','email','website','address','ein','w9_on_file','coi_on_file','coi_expires','notes'];
  const update = {};
  for (const f of fields) if (f in body) update[f] = body[f];

  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('companies')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: data });
}

export async function DELETE(_req, { params }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const supa = getSupabaseAdmin();
  const { error } = await supa.from('companies').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
