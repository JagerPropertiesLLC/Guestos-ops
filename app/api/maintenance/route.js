// app/api/maintenance/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(request) {
  const supa = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const module_filter = searchParams.get('module');
  const status_filter = searchParams.get('status');
  const property_id = searchParams.get('property_id');

  let q = supa.from('maintenance_requests')
    .select(`
      id, title, description, category, priority, status, module,
      property:properties!property_id(id, short_name),
      assigned_to_company:companies!assigned_to_company_id(id, name),
      submitted_by_type, submitted_by_tenant_id,
      created_at, updated_at, resolved_at
    `)
    .order('created_at', { ascending: false });

  if (module_filter) q = q.eq('module', module_filter);
  if (status_filter) q = q.eq('status', status_filter);
  if (property_id) q = q.eq('property_id', property_id);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(request) {
  const supa = getSupabaseAdmin();
  const body = await request.json();
  const { property_id, title, description, category, priority, module = 'ltr', submitted_by_type = 'staff' } = body;

  if (!property_id || !title) {
    return NextResponse.json({ error: 'property_id and title required' }, { status: 400 });
  }

  const { data, error } = await supa
    .from('maintenance_requests')
    .insert({
      property_id, title, description: description || null,
      category: category || 'other', priority: priority || 'normal',
      module, submitted_by_type
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
