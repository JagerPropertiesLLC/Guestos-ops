// app/api/companies/[id]/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { currentUserId } from '@/lib/permissions';
import { countCompanyDeps } from '@/lib/rolodexDeps';

export async function GET(_req, { params }) {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('companies')
    .select(`
      id, name, type, phone, email, website, address, ein,
      w9_on_file, coi_on_file, coi_expires, multi_market, notes,
      created_at, updated_at,
      market:markets!primary_market_id(id, slug, name)
    `)
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ company: data });
}

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

  const deps = await countCompanyDeps(params.id);
  if (deps.total > 0) {
    return NextResponse.json(
      {
        error: 'company_has_dependencies',
        message: `Cannot delete: company is referenced by ${deps.total} record(s).`,
        dependencies: deps.by_table
      },
      { status: 409 }
    );
  }

  const supa = getSupabaseAdmin();
  const { error } = await supa.from('companies').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
