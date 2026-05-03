// app/api/construction/companies/route.js
// Search companies (case-insensitive, name-prefix bias) and create-on-the-fly.
// Used by the vendor picker on the expense modal.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { assertConstructionAccess } from '@/lib/constructionAuth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(req) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100);

  const supa = getSupabaseAdmin();
  let query = supa
    .from('companies')
    .select('id, name, type, phone, email')
    .order('name', { ascending: true })
    .limit(limit);

  if (q) query = query.ilike('name', `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ companies: data || [] });
}

export async function POST(req) {
  const callerId = await assertConstructionAccess(req);
  if (!callerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }

  const supa = getSupabaseAdmin();

  // Case-insensitive dupe guard — return the existing row instead of creating one.
  const { data: existing } = await supa
    .from('companies')
    .select('id, name, type, phone, email')
    .ilike('name', body.name.trim())
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ company: existing, existed: true });

  const insert = {
    name: body.name.trim(),
    type: body.type || 'vendor',
    phone: body.phone || null,
    email: body.email || null,
  };

  const { data, error } = await supa.from('companies').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ company: data }, { status: 201 });
}
