// app/api/swppp/reports/[id]/pdf/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { buildWeeklyReportPdf } from '@/lib/swpppPdf';

export async function GET(_request, { params }) {
  try {
    const supa = getSupabaseAdmin();

    const { data: report, error } = await supa
      .from('swppp_reports')
      .select(`
        *,
        swppp_project:swppp_projects!swppp_project_id(
          id, cdps_permit_number, ms4_authority,
          project:projects!project_id(id, name, address)
        )
      `)
      .eq('id', params.id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    const { data: inspections = [] } = await supa
      .from('swppp_inspections')
      .select('id, inspection_date, inspection_type, inspector_name, status')
      .eq('swppp_project_id', report.swppp_project_id)
      .gte('inspection_date', report.period_start)
      .lte('inspection_date', report.period_end)
      .order('inspection_date', { ascending: true });

    const { data: storms = [] } = await supa
      .from('swppp_weather_events')
      .select('event_date, rolling_24h_inches, event_type, inspection_satisfied')
      .eq('swppp_project_id', report.swppp_project_id)
      .gte('event_date', report.period_start)
      .lte('event_date', report.period_end)
      .order('event_date');

    const pdfBytes = await buildWeeklyReportPdf({ report, storms, inspections });

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="SWPPP-Weekly-${report.period_start}-to-${report.period_end}.pdf"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    console.error('[swppp weekly pdf]', e);
    return NextResponse.json({ error: 'PDF generation failed', detail: e.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
