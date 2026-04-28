// app/api/swppp/inspections/[id]/pdf/route.js
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { buildInspectionPdf } from '@/lib/swpppPdf';

export async function GET(_request, { params }) {
  try {
    const supa = getSupabaseAdmin();

    const { data: inspection, error } = await supa
      .from('swppp_inspections')
      .select(`
        *,
        swppp_project:swppp_projects!swppp_project_id(
          id, cdps_permit_number,
          project:projects!project_id(id, name, address)
        )
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

    const pdfBytes = await buildInspectionPdf({ inspection, bmpFindings, siteCheckFindings, correctiveActions });

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="SWPPP-Inspection-${inspection.inspection_date}.pdf"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    console.error('[swppp inspection pdf]', e);
    return NextResponse.json({ error: 'PDF generation failed', detail: e.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
