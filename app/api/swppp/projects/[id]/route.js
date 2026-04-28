// app/api/swppp/projects/[id]/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(_request, { params }) {
  const supa = getSupabaseAdmin();

  const { data: swppp, error } = await supa
    .from('swppp_projects')
    .select(`
      *,
      project:projects!project_id(id, name, address, entity_name)
    `)
    .eq('id', params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Latest inspections, BMPs, recent weather events, open CAs, report archive
  const [
    { data: bmps = [] },
    { data: siteChecks = [] },
    { data: inspections = [] },
    { data: weatherEvents = [] },
    { data: reports = [] },
    { data: openCAs = [] }
  ] = await Promise.all([
    supa.from('swppp_bmps').select('*').eq('swppp_project_id', params.id).eq('active', true).order('bmp_number'),
    supa.from('swppp_site_checks').select('*').eq('swppp_project_id', params.id).order('sort_order'),
    supa.from('swppp_inspections').select('id, inspection_date, inspection_type, inspector_name, status, storm_event_id, certified_at')
      .eq('swppp_project_id', params.id).order('inspection_date', { ascending: false }).limit(30),
    supa.from('swppp_weather_events').select('*').eq('swppp_project_id', params.id).order('event_date', { ascending: false }).limit(20),
    supa.from('swppp_reports').select('*').eq('swppp_project_id', params.id).order('period_end', { ascending: false }).limit(52),
    supa.from('swppp_corrective_actions').select('id, description, identified_date, due_date, status, inspection:swppp_inspections!inspection_id!inner(swppp_project_id)')
      .in('status', ['open', 'in_progress'])
  ]);

  // Filter open CAs to this project (the inner join above did the filter)
  const filteredCAs = openCAs.filter(ca => ca.inspection?.swppp_project_id === params.id);

  return NextResponse.json({
    swppp,
    bmps,
    site_checks: siteChecks,
    inspections,
    weather_events: weatherEvents,
    reports,
    open_corrective_actions: filteredCAs
  });
}

export async function PATCH(request, { params }) {
  const supa = getSupabaseAdmin();
  const body = await request.json();
  const allowed = [
    'cdps_permit_number','npdes_tracking_number','ms4_authority',
    'inspection_schedule','weekly_anchor_day',
    'weather_zip','weather_lat','weather_lon','rain_threshold_inches',
    'qualified_stormwater_manager_name','qualified_stormwater_manager_phone',
    'construction_start_date','notice_of_termination_date',
    'public_qr_active','active','notes'
  ];
  const update = {};
  for (const k of allowed) if (k in body) update[k] = body[k];

  // If turning on public QR and there's no token yet, generate one
  if (body.public_qr_active === true) {
    const { data: existing } = await supa.from('swppp_projects').select('public_qr_token').eq('id', params.id).single();
    if (!existing?.public_qr_token) {
      update.public_qr_token = generateToken();
    }
  }

  update.updated_at = new Date().toISOString();
  const { data, error } = await supa.from('swppp_projects').update(update).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ swppp: data });
}

function generateToken() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

export const dynamic = 'force-dynamic';
