// app/api/contacts/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { currentUserId } from '@/lib/permissions';

export async function GET(request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const market = searchParams.get('market');         // 'pueblo' | 'aurora' | 'all'
  const trade = searchParams.get('trade');
  const search = searchParams.get('q');

  const supa = getSupabaseAdmin();
  let q = supa.from('contacts').select(`
      id, first_name, last_name, trade, phone, email, primary_market_id, multi_market, rating, notes,
      company:companies!company_id(id, name),
      market:markets!primary_market_id(id, slug, name)
    `).order('last_name', { ascending: true });

  if (market && market !== 'all') {
    const { data: m } = await supa.from('markets').select('id').eq('slug', market).single();
    if (m) {
      q = q.or(`primary_market_id.eq.${m.id},multi_market.eq.true`);
    }
  }
  if (trade) q = q.eq('trade', trade);
  if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data });
}

export async function POST(request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'No user' }, { status: 401 });

  const body = await request.json();
  const { first_name, last_name, company_id, primary_market_slug, multi_market, trade, phone, email, rating, notes } = body;
  if (!first_name) return NextResponse.json({ error: 'first_name required' }, { status: 400 });

  const supa = getSupabaseAdmin();
  let primary_market_id = null;
  if (primary_market_slug) {
    const { data: m } = await supa.from('markets').select('id').eq('slug', primary_market_slug).single();
    primary_market_id = m?.id || null;
  }

  const { data, error } = await supa
    .from('contacts')
    .insert({
      first_name, last_name: last_name || null,
      company_id: company_id || null,
      primary_market_id, multi_market: !!multi_market,
      trade: trade || null,
      phone: phone || null, email: email || null,
      rating: rating || null, notes: notes || null
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}
