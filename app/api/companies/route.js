// app/api/companies/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { currentUserId } from '@/lib/permissions';

export async function GET(request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market');
  const type = searchParams.get('type');

  const supa = getSupabaseAdmin();
  let q = supa.from('companies').select(`
      id, name, type, phone, email, website, ein, w9_on_file, coi_on_file, coi_expires, multi_market, notes,
      market:markets!primary_market_id(id, slug, name)
    `).order('name', { ascending: true });

  if (market && market !== 'all') {
    const { data: m } = await supa.from('markets').select('id').eq('slug', market).single();
    if (m) q = q.or(`primary_market_id.eq.${m.id},multi_market.eq.true`);
  }
  if (type) q = q.eq('type', type);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ companies: data });
}

export async function POST(request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await request.json();
  const { name, type, primary_market_slug, multi_market, phone, email, website, address, ein, w9_on_file, coi_on_file, coi_expires, notes } = body;
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const supa = getSupabaseAdmin();
  let primary_market_id = null;
  if (primary_market_slug) {
    const { data: m } = await supa.from('markets').select('id').eq('slug', primary_market_slug).single();
    primary_market_id = m?.id || null;
  }

  const { data, error } = await supa
    .from('companies')
    .insert({
      name, type: type || null,
      primary_market_id, multi_market: !!multi_market,
      phone: phone || null, email: email || null, website: website || null,
      address: address || null, ein: ein || null,
      w9_on_file: !!w9_on_file, coi_on_file: !!coi_on_file,
      coi_expires: coi_expires || null,
      notes: notes || null
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: data });
}
