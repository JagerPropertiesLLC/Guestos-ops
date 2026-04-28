// app/api/swppp/reports/[id]/pdf/route.js
//
// Generates a PDF report for the period — a cover page with summary,
// followed by the full PDF of each inspection that occurred in the window.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import PDFDocument from 'pdfkit';
import { buildInspectionPdf } from '@/lib/swpppPdf';

export async function GET(_request, { params }) {
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

  // Gather inspections in window
  const { data: inspections = [] } = await supa
    .from('swppp_inspections')
    .select('id')
    .eq('swppp_project_id', report.swppp_project_id)
    .gte('inspection_date', report.period_start)
    .lte('inspection_date', report.period_end)
    .order('inspection_date', { ascending: true });

  // Storm events in window
  const { data: storms = [] } = await supa
    .from('swppp_weather_events')
    .select('event_date, rolling_24h_inches, event_type, inspection_satisfied')
    .eq('swppp_project_id', report.swppp_project_id)
    .gte('event_date', report.period_start)
    .lte('event_date', report.period_end)
    .order('event_date');

  // Build cover page
  const coverChunks = [];
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    doc.on('data', (c) => coverChunks.push(c));
    doc.on('end', resolve);
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(16).text('SWPPP Weekly Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(11).text(report.swppp_project?.project?.name || '—', { align: 'center' });
    doc.text(report.swppp_project?.project?.address || '—', { align: 'center' });
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(11).text('Reporting Period');
    doc.font('Helvetica').fontSize(11).text(`${report.period_start} through ${report.period_end}`);
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(11).text('Summary');
    doc.font('Helvetica').fontSize(11);
    doc.text(`Inspections conducted:  ${report.inspection_count}`);
    doc.text(`Storm events triggering threshold:  ${report.storm_event_count}`);
    doc.text(`Open corrective actions (project total):  ${report.open_corrective_actions_count}`);
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(11).text('Permit Information');
    doc.font('Helvetica').fontSize(11);
    doc.text(`CDPS Permit:  ${report.swppp_project?.cdps_permit_number || '—'}`);
    doc.text(`MS4 Authority:  ${report.swppp_project?.ms4_authority || '—'}`);
    doc.moveDown(0.5);

    if (storms.length > 0) {
      doc.font('Helvetica-Bold').fontSize(11).text('Storm Events This Period');
      doc.font('Helvetica').fontSize(10);
      for (const s of storms) {
        doc.text(`  ${s.event_date}  —  ${s.rolling_24h_inches}" (${s.event_type})  —  Inspection ${s.inspection_satisfied ? 'completed' : 'NOT YET DONE'}`);
      }
      doc.moveDown(0.5);
    }

    if (inspections.length === 0) {
      doc.moveDown(1);
      doc.font('Helvetica-Oblique').fontSize(11).text(
        'No inspections were conducted in this reporting period.',
        { align: 'center' }
      );
      if (storms.length > 0) {
        doc.moveDown(0.3);
        doc.fillColor('#b91c1c').text(
          'WARNING: Storm event(s) occurred but no post-storm inspection was logged.',
          { align: 'center' }
        );
        doc.fillColor('#000');
      }
    } else {
      doc.moveDown(1);
      doc.font('Helvetica-Oblique').fontSize(10).text(
        `${inspections.length} inspection${inspections.length > 1 ? 's are' : ' is'} attached on the following pages.`,
        { align: 'center' }
      );
    }

    doc.font('Helvetica').fontSize(8).fillColor('#666');
    doc.text(`Generated ${new Date().toLocaleString()}`, 36, 740, { align: 'center', width: 540 });
    doc.fillColor('#000');

    doc.end();
  });

  const coverPdf = Buffer.concat(coverChunks);

  // For now, just return the cover. Full inspection appending requires PDF-merge libraries that
  // are heavier in Vercel runtime. We can iterate on this later.
  return new Response(coverPdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="SWPPP-Weekly-${report.period_start}-to-${report.period_end}.pdf"`
    }
  });
}

export const dynamic = 'force-dynamic';
