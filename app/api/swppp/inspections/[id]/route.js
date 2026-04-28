// app/api/swppp/inspections/[id]/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(_request, { params }) {
  const supa = getSupabaseAdmin();

  const { data: inspection, error } = await supa
    .from('swppp_inspections')
    .select(`
      *,
      swppp_project:swppp_projects!swppp_project_id(
        id, weather_lat, weather_lon, ms4_authority, cdps_permit_number,
        project:projects!project_id(id, name, address)
      ),
      storm_event:swppp_weather_events!storm_event_id(id, event_date, rolling_24h_inches)
    `)
    .eq('id', params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const [
    { data: bmpFindings = [] },
    { data: siteCheckFindings = [] },
    { data: correctiveActions = [] }
  ] = await Promise.all([
    supa.from('swppp_bmp_findings').select('*, bmp:swppp_bmps!bmp_id(*)').eq('inspection_id', params.id),
    supa.from('swppp_site_check_findings').select('*, site_check:swppp_site_checks!site_check_id(*)').eq('inspection_id', params.id),
    supa.from('swppp_corrective_actions').select('*').eq('inspection_id', params.id)
  ]);

  return NextResponse.json({
    inspection,
    bmp_findings: bmpFindings,
    site_check_findings: siteCheckFindings,
    corrective_actions: correctiveActions
  });
}

export const dynamic = 'force-dynamic';
