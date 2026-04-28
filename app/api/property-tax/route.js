// app/api/property-tax/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from('property_taxes')
    .select(`
      id, tax_year, assessed_value, taxable_value, total_tax,
      due_date, paid_date, amount_paid, authority, parcel_number,
      property:properties!property_id(id, short_name, full_address)
    `)
    .order('tax_year', { ascending: false })
    .order('due_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Annotate with status
  const today = new Date().toISOString().slice(0, 10);
  const annotated = (data || []).map(r => {
    let status = 'unpaid';
    if (r.paid_date) status = 'paid';
    else if (r.due_date && r.due_date < today) status = 'overdue';
    else if (r.due_date) {
      const days = Math.floor((new Date(r.due_date).getTime() - Date.now()) / 86400000);
      if (days <= 30) status = 'due_soon';
    }
    return { ...r, status };
  });
  return NextResponse.json({ records: annotated });
}

export async function POST(request) {
  const supa = getSupabaseAdmin();
  const body = await request.json();
  const { property_id, tax_year, assessed_value, taxable_value, total_tax, due_date, authority, parcel_number, notes } = body;
  if (!property_id || !tax_year) {
    return NextResponse.json({ error: 'property_id and tax_year required' }, { status: 400 });
  }
  const { data, error } = await supa.from('property_taxes').insert({
    property_id, tax_year, assessed_value, taxable_value, total_tax, due_date, authority, parcel_number, notes
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ record: data });
}

export const dynamic = 'force-dynamic';
