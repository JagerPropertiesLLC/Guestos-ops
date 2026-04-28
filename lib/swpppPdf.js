// lib/swpppPdf.js
//
// Builds an EPA-style SWPPP inspection report PDF using pdfkit.
// Mirrors the form fields:
//   - General Information (project, NPDES, location, date, inspector, etc.)
//   - Type of Inspection (Regular/Pre-storm/During/Post)
//   - Weather Information (storm since last? current weather, temp)
//   - Discharges (since last, current)
//   - Site-specific BMPs table
//   - Overall Site Issues table
//   - Non-Compliance description
//   - Certification statement + signature
//
// Returns a Buffer.

import PDFDocument from 'pdfkit';

const CHECK = '[X]';
const UNCHECK = '[ ]';

function check(b) { return b ? CHECK : UNCHECK; }
function safe(v) { return v == null || v === '' ? '—' : String(v); }

export async function buildInspectionPdf({ inspection, bmpFindings, siteCheckFindings, correctiveActions }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const proj = inspection.swppp_project?.project || {};

      // --- HEADER ---
      doc.font('Helvetica-Bold').fontSize(14).text('Stormwater Construction Site Inspection Report', { align: 'center' });
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(8).text('Standard EPA SWPPP Sample Inspection Report (Appendix B)', { align: 'center' });
      doc.moveDown(0.6);

      // --- GENERAL INFO TABLE ---
      sectionHeader(doc, 'General Information');
      twoColRows(doc, [
        ['Project Name', safe(proj.name)],
        ['NPDES Tracking No.', safe(inspection.swppp_project?.cdps_permit_number)],
        ['Location', safe(proj.address)],
        ['Date of Inspection', formatDate(inspection.inspection_date)],
        ['Start/End Time', `${safe(inspection.start_time)} / ${safe(inspection.end_time)}`],
        ['Inspector\u2019s Name', safe(inspection.inspector_name)],
        ['Inspector\u2019s Title', safe(inspection.inspector_title)],
        ['Inspector\u2019s Contact', safe(inspection.inspector_contact)],
        ['Inspector\u2019s Qualifications', safe(inspection.inspector_qualifications)],
        ['Present Phase of Construction', safe(inspection.construction_phase_description)]
      ]);
      doc.moveDown(0.3);

      // --- TYPE OF INSPECTION ---
      doc.font('Helvetica-Bold').fontSize(10).text('Type of Inspection:');
      doc.font('Helvetica').fontSize(10);
      doc.text(`${check(inspection.inspection_type === 'regular')} Regular        ` +
               `${check(inspection.inspection_type === 'pre_storm')} Pre-storm event        ` +
               `${check(inspection.inspection_type === 'during_storm')} During storm event        ` +
               `${check(inspection.inspection_type === 'post_storm')} Post-storm event`);
      doc.moveDown(0.3);

      // --- WEATHER INFO ---
      sectionHeader(doc, 'Weather Information');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Has there been a storm event since the last inspection? ${check(inspection.storm_since_last_inspection)} Yes  ${check(!inspection.storm_since_last_inspection)} No`);
      if (inspection.storm_since_last_inspection) {
        doc.text(`   Storm Start: ${safe(inspection.storm_start_at)}    Duration (hrs): ${safe(inspection.storm_duration_hours)}    Precipitation (in): ${safe(inspection.storm_precipitation_inches)}`);
      }
      doc.moveDown(0.2);
      doc.text('Weather at time of this inspection:');
      doc.text(
        `   ${check(inspection.weather_clear)} Clear  ` +
        `${check(inspection.weather_cloudy)} Cloudy  ` +
        `${check(inspection.weather_rain)} Rain  ` +
        `${check(inspection.weather_sleet)} Sleet  ` +
        `${check(inspection.weather_fog)} Fog  ` +
        `${check(inspection.weather_snowing)} Snowing  ` +
        `${check(inspection.weather_high_winds)} High Winds`
      );
      if (inspection.weather_other) doc.text(`   Other: ${inspection.weather_other}`);
      doc.text(`   Temperature: ${safe(inspection.weather_temp_f)} °F`);
      doc.moveDown(0.3);

      // --- DISCHARGES ---
      doc.font('Helvetica-Bold').fontSize(10).text('Discharges');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Have any discharges occurred since the last inspection? ${check(inspection.discharges_since_last)} Yes  ${check(!inspection.discharges_since_last)} No`);
      if (inspection.discharges_since_last && inspection.discharges_since_last_description) {
        doc.text(`   ${inspection.discharges_since_last_description}`);
      }
      doc.text(`Are there any discharges at the time of inspection? ${check(inspection.discharges_now)} Yes  ${check(!inspection.discharges_now)} No`);
      if (inspection.discharges_now && inspection.discharges_now_description) {
        doc.text(`   ${inspection.discharges_now_description}`);
      }
      doc.moveDown(0.4);

      // --- BMP TABLE ---
      sectionHeader(doc, 'Site-specific BMPs');
      bmpTable(doc, bmpFindings);
      doc.moveDown(0.3);

      // --- OVERALL SITE ISSUES TABLE ---
      sectionHeader(doc, 'Overall Site Issues');
      siteCheckTable(doc, siteCheckFindings);
      doc.moveDown(0.3);

      // --- CORRECTIVE ACTIONS ---
      if (correctiveActions && correctiveActions.length > 0) {
        sectionHeader(doc, 'Corrective Action Log');
        correctiveActions.forEach((ca, i) => {
          doc.font('Helvetica').fontSize(9);
          doc.text(`${i + 1}. ${ca.description}`);
          doc.text(`   Identified: ${ca.identified_date}    Due: ${safe(ca.due_date)}    Status: ${ca.status}`);
          if (ca.responsible_person) doc.text(`   Responsible: ${ca.responsible_person}`);
          doc.moveDown(0.2);
        });
      }

      // --- NON-COMPLIANCE ---
      sectionHeader(doc, 'Non-Compliance');
      doc.font('Helvetica').fontSize(10).text(safe(inspection.non_compliance_notes));
      doc.moveDown(0.5);

      // --- CERTIFICATION ---
      sectionHeader(doc, 'Certification Statement');
      doc.font('Helvetica').fontSize(8);
      doc.text(
        '"I certify under penalty of law that this document and all attachments were prepared under my direction or supervision in accordance with a system designed to assure that qualified personnel properly gathered and evaluated the information submitted. Based on my inquiry of the person or persons who manage the system, or those persons directly responsible for gathering the information, the information submitted is, to the best of my knowledge and belief, true, accurate, and complete. I am aware that there are significant penalties for submitting false information, including the possibility of fine and imprisonment for knowing violations."',
        { align: 'justify' }
      );
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10);
      doc.text(`Print name and title: ${safe(inspection.certified_by_name)}${inspection.certified_by_title ? ', ' + inspection.certified_by_title : ''}`);
      doc.text(`Signature: ${inspection.signature_data ? '/s/ ' + safe(inspection.certified_by_name) : '_______________________________'}    Date: ${formatDate(inspection.certified_at)}`);

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function sectionHeader(doc, title) {
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(title);
  doc.moveTo(doc.x, doc.y).lineTo(doc.x + 500, doc.y).stroke();
  doc.moveDown(0.2);
}

function twoColRows(doc, rows) {
  doc.font('Helvetica').fontSize(10);
  for (const [label, value] of rows) {
    const startY = doc.y;
    doc.font('Helvetica-Bold').text(label, doc.x, startY, { width: 180, continued: false });
    doc.font('Helvetica').text(value, doc.x + 180, startY, { width: 320 });
    doc.moveDown(0.1);
  }
}

function bmpTable(doc, findings) {
  if (!findings || findings.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(9).text('— No BMP findings recorded —');
    return;
  }
  const colWidths = [25, 150, 60, 80, 200];
  const headers = ['#', 'BMP', 'Installed?', 'Maint. Req?', 'Notes'];
  drawTableRow(doc, headers, colWidths, true);
  for (const f of findings) {
    drawTableRow(doc, [
      String(f.bmp?.bmp_number || ''),
      `${f.bmp?.bmp_code ? f.bmp.bmp_code + ' — ' : ''}${f.bmp?.bmp_name || ''}`,
      f.installed === true ? 'Yes' : f.installed === false ? 'No' : '—',
      f.maintenance_required === true ? 'Yes' : f.maintenance_required === false ? 'No' : '—',
      f.notes || ''
    ], colWidths);
  }
}

function siteCheckTable(doc, findings) {
  if (!findings || findings.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(9).text('— No site check findings recorded —');
    return;
  }
  const colWidths = [25, 280, 50, 70, 90];
  const headers = ['#', 'BMP/Activity', 'OK?', 'Maint. Req?', 'Notes'];
  drawTableRow(doc, headers, colWidths, true);
  for (const f of findings) {
    drawTableRow(doc, [
      String(f.site_check?.check_number || ''),
      f.site_check?.check_question || '',
      f.site_check?.applicable === false ? 'N/A' : (f.passing === true ? 'Yes' : f.passing === false ? 'No' : '—'),
      f.site_check?.applicable === false ? 'N/A' : (f.maintenance_required === true ? 'Yes' : f.maintenance_required === false ? 'No' : '—'),
      f.notes || ''
    ], colWidths);
  }
}

function drawTableRow(doc, cells, widths, isHeader) {
  doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
  const startX = doc.x;
  const startY = doc.y;
  let x = startX;
  let maxRowHeight = 0;
  // Pre-compute heights
  for (let i = 0; i < cells.length; i++) {
    const h = doc.heightOfString(cells[i] || '', { width: widths[i] - 4 });
    if (h > maxRowHeight) maxRowHeight = h;
  }
  // Draw cells
  x = startX;
  for (let i = 0; i < cells.length; i++) {
    doc.rect(x, startY, widths[i], maxRowHeight + 4).stroke();
    doc.text(cells[i] || '', x + 2, startY + 2, { width: widths[i] - 4, height: maxRowHeight });
    x += widths[i];
  }
  doc.y = startY + maxRowHeight + 4;
  doc.x = startX;
}

function formatDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-US');
  } catch { return String(d); }
}
