// lib/swpppPdf.js
//
// EPA-style SWPPP inspection report PDF using pdf-lib.
// pdf-lib has built-in standard fonts that work in serverless without any bundling issues.
//
// Returns a Uint8Array (Buffer-like).

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

export async function buildInspectionPdf({ inspection, bmpFindings, siteCheckFindings, correctiveActions }) {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helvOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const proj = inspection.swppp_project?.project || {};

  function newPageIfNeeded(needed = 40) {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function text(str, opts = {}) {
    const { font = helv, size = 10, color = rgb(0, 0, 0), x = MARGIN, indent = 0, maxWidth = CONTENT_W } = opts;
    const s = String(str ?? '');
    const lines = wrapText(s, font, size, maxWidth - indent);
    for (const line of lines) {
      newPageIfNeeded(size + 4);
      page.drawText(line, { x: x + indent, y: y - size, size, font, color });
      y -= size + 4;
    }
  }

  function spacer(h = 6) { y -= h; }

  function sectionHeader(title) {
    spacer(6);
    newPageIfNeeded(20);
    page.drawText(title, { x: MARGIN, y: y - 11, size: 11, font: helvBold });
    y -= 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0, 0, 0) });
    y -= 8;
  }

  function labelValue(label, value) {
    newPageIfNeeded(14);
    const labelText = label + ':';
    page.drawText(labelText, { x: MARGIN, y: y - 10, size: 10, font: helvBold });
    const valueX = MARGIN + 170;
    const valueLines = wrapText(safe(value), helv, 10, CONTENT_W - 170);
    page.drawText(valueLines[0] || '', { x: valueX, y: y - 10, size: 10, font: helv });
    y -= 13;
    for (let i = 1; i < valueLines.length; i++) {
      newPageIfNeeded(13);
      page.drawText(valueLines[i], { x: valueX, y: y - 10, size: 10, font: helv });
      y -= 13;
    }
  }

  function checkboxLine(items) {
    // items is array of {label, checked}
    newPageIfNeeded(14);
    let x = MARGIN;
    for (const item of items) {
      const symbol = item.checked ? '[X] ' : '[ ] ';
      const t = symbol + item.label;
      const w = helv.widthOfTextAtSize(t, 10);
      if (x + w > PAGE_W - MARGIN) {
        y -= 13;
        x = MARGIN;
        newPageIfNeeded(14);
      }
      page.drawText(t, { x, y: y - 10, size: 10, font: helv });
      x += w + 14;
    }
    y -= 13;
  }

  // === HEADER ===
  page.drawText('Stormwater Construction Site Inspection Report', {
    x: MARGIN, y: y - 14, size: 14, font: helvBold
  });
  y -= 18;
  page.drawText('EPA SWPPP Sample Inspection Report (Appendix B)', {
    x: MARGIN, y: y - 8, size: 8, font: helvOblique, color: rgb(0.4, 0.4, 0.4)
  });
  y -= 16;

  // === GENERAL INFO ===
  sectionHeader('General Information');
  labelValue('Project Name', proj.name);
  labelValue('NPDES Tracking No.', inspection.swppp_project?.cdps_permit_number);
  labelValue('Location', proj.address);
  labelValue('Date of Inspection', formatDate(inspection.inspection_date));
  labelValue('Start / End Time', `${safe(inspection.start_time)} / ${safe(inspection.end_time)}`);
  labelValue('Inspector\'s Name', inspection.inspector_name);
  labelValue('Inspector\'s Title', inspection.inspector_title);
  labelValue('Inspector\'s Contact', inspection.inspector_contact);
  labelValue('Inspector\'s Qualifications', inspection.inspector_qualifications);
  labelValue('Phase of Construction', inspection.construction_phase_description);

  // === TYPE OF INSPECTION ===
  spacer(6);
  newPageIfNeeded(20);
  page.drawText('Type of Inspection:', { x: MARGIN, y: y - 10, size: 10, font: helvBold });
  y -= 14;
  checkboxLine([
    { label: 'Regular', checked: inspection.inspection_type === 'regular' },
    { label: 'Pre-storm event', checked: inspection.inspection_type === 'pre_storm' },
    { label: 'During storm event', checked: inspection.inspection_type === 'during_storm' },
    { label: 'Post-storm event', checked: inspection.inspection_type === 'post_storm' }
  ]);

  // === WEATHER ===
  sectionHeader('Weather Information');
  text(`Storm event since last inspection? ${inspection.storm_since_last_inspection ? '[X] Yes [ ] No' : '[ ] Yes [X] No'}`);
  if (inspection.storm_since_last_inspection) {
    text(`   Storm start: ${safe(inspection.storm_start_at)}    Duration (hrs): ${safe(inspection.storm_duration_hours)}    Precipitation (in): ${safe(inspection.storm_precipitation_inches)}`);
  }
  spacer(4);
  page.drawText('Weather at time of this inspection:', { x: MARGIN, y: y - 10, size: 10, font: helvBold });
  y -= 14;
  checkboxLine([
    { label: 'Clear', checked: !!inspection.weather_clear },
    { label: 'Cloudy', checked: !!inspection.weather_cloudy },
    { label: 'Rain', checked: !!inspection.weather_rain },
    { label: 'Sleet', checked: !!inspection.weather_sleet },
    { label: 'Fog', checked: !!inspection.weather_fog },
    { label: 'Snowing', checked: !!inspection.weather_snowing },
    { label: 'High Winds', checked: !!inspection.weather_high_winds }
  ]);
  if (inspection.weather_other) text(`Other: ${inspection.weather_other}`);
  text(`Temperature: ${safe(inspection.weather_temp_f)}°F`);

  // === DISCHARGES ===
  sectionHeader('Discharges');
  text(`Have any discharges occurred since the last inspection? ${inspection.discharges_since_last ? '[X] Yes' : '[X] No'}`);
  if (inspection.discharges_since_last && inspection.discharges_since_last_description) {
    text(`   ${inspection.discharges_since_last_description}`, { indent: 12 });
  }
  text(`Are there any discharges at the time of inspection? ${inspection.discharges_now ? '[X] Yes' : '[X] No'}`);
  if (inspection.discharges_now && inspection.discharges_now_description) {
    text(`   ${inspection.discharges_now_description}`, { indent: 12 });
  }

  // === BMPs ===
  sectionHeader('Site-specific BMPs');
  if (!bmpFindings || bmpFindings.length === 0) {
    text('— No BMP findings recorded —', { font: helvOblique, color: rgb(0.5, 0.5, 0.5) });
  } else {
    drawBmpTable(page, pdf, helv, helvBold, bmpFindings, () => y, (newY) => { y = newY; });
    // The drawBmpTable closure modifies y
  }

  // === SITE CHECKS ===
  sectionHeader('Overall Site Issues');
  if (!siteCheckFindings || siteCheckFindings.length === 0) {
    text('— No site check findings recorded —', { font: helvOblique, color: rgb(0.5, 0.5, 0.5) });
  } else {
    for (const f of siteCheckFindings) {
      newPageIfNeeded(40);
      const status = f.site_check?.applicable === false ? 'N/A'
                   : f.passing === true ? 'OK'
                   : f.passing === false ? 'NEEDS ATTN'
                   : '—';
      page.drawText(`${f.site_check?.check_number || ''}. `, { x: MARGIN, y: y - 10, size: 9, font: helvBold });
      const qtxt = f.site_check?.check_question || '';
      const qLines = wrapText(qtxt, helv, 9, CONTENT_W - 80);
      page.drawText(qLines[0] || '', { x: MARGIN + 18, y: y - 10, size: 9, font: helv });
      page.drawText(status, { x: PAGE_W - MARGIN - 60, y: y - 10, size: 9, font: helvBold });
      y -= 12;
      for (let i = 1; i < qLines.length; i++) {
        newPageIfNeeded(12);
        page.drawText(qLines[i], { x: MARGIN + 18, y: y - 10, size: 9, font: helv });
        y -= 12;
      }
      if (f.notes) {
        text(f.notes, { font: helvOblique, indent: 18, size: 8 });
      }
      spacer(2);
    }
  }

  // === CORRECTIVE ACTIONS ===
  if (correctiveActions && correctiveActions.length > 0) {
    sectionHeader('Corrective Action Log');
    for (let i = 0; i < correctiveActions.length; i++) {
      const ca = correctiveActions[i];
      text(`${i + 1}. ${ca.description}`, { font: helvBold });
      text(`   Identified: ${ca.identified_date}    Due: ${safe(ca.due_date)}    Status: ${ca.status}`);
      if (ca.responsible_person) text(`   Responsible: ${ca.responsible_person}`);
      spacer(4);
    }
  }

  // === NON-COMPLIANCE ===
  sectionHeader('Non-Compliance');
  text(safe(inspection.non_compliance_notes));

  // === CERTIFICATION ===
  sectionHeader('Certification Statement');
  text(
    '"I certify under penalty of law that this document and all attachments were prepared under my direction or supervision in accordance with a system designed to assure that qualified personnel properly gathered and evaluated the information submitted. Based on my inquiry of the person or persons who manage the system, or those persons directly responsible for gathering the information, the information submitted is, to the best of my knowledge and belief, true, accurate, and complete. I am aware that there are significant penalties for submitting false information, including the possibility of fine and imprisonment for knowing violations."',
    { size: 8 }
  );
  spacer(8);
  text(`Print name and title: ${safe(inspection.certified_by_name)}${inspection.certified_by_title ? ', ' + inspection.certified_by_title : ''}`);
  text(`Signature: ${inspection.signature_data ? '/s/ ' + safe(inspection.certified_by_name) : '_______________________________'}    Date: ${formatDate(inspection.certified_at)}`);

  return await pdf.save();
}

// Weekly report PDF (cover + summary)
export async function buildWeeklyReportPdf({ report, storms, inspections }) {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const helvOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const proj = report.swppp_project?.project || {};

  page.drawText('SWPPP Weekly Report', { x: MARGIN, y: y - 18, size: 18, font: helvBold });
  y -= 26;
  page.drawText(safe(proj.name), { x: MARGIN, y: y - 12, size: 12, font: helv });
  y -= 16;
  page.drawText(safe(proj.address), { x: MARGIN, y: y - 10, size: 10, font: helv, color: rgb(0.4, 0.4, 0.4) });
  y -= 24;

  // Period
  page.drawText('Reporting Period', { x: MARGIN, y: y - 11, size: 11, font: helvBold });
  y -= 14;
  page.drawText(`${report.period_start} through ${report.period_end}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 22;

  // Summary
  page.drawText('Summary', { x: MARGIN, y: y - 11, size: 11, font: helvBold });
  y -= 14;
  page.drawText(`Inspections conducted: ${report.inspection_count}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 12;
  page.drawText(`Storm events triggering threshold: ${report.storm_event_count}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 12;
  page.drawText(`Open corrective actions (project total): ${report.open_corrective_actions_count}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 22;

  // Permit info
  page.drawText('Permit Information', { x: MARGIN, y: y - 11, size: 11, font: helvBold });
  y -= 14;
  page.drawText(`CDPS Permit: ${safe(report.swppp_project?.cdps_permit_number)}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 12;
  page.drawText(`MS4 Authority: ${safe(report.swppp_project?.ms4_authority)}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 22;

  if (storms && storms.length > 0) {
    page.drawText('Storm Events This Period', { x: MARGIN, y: y - 11, size: 11, font: helvBold });
    y -= 14;
    for (const s of storms) {
      page.drawText(`  ${s.event_date} — ${s.rolling_24h_inches}" (${s.event_type}) — Inspection ${s.inspection_satisfied ? 'completed' : 'NOT YET DONE'}`,
        { x: MARGIN, y: y - 10, size: 10, font: helv });
      y -= 12;
    }
    y -= 10;
  }

  if (!inspections || inspections.length === 0) {
    y -= 20;
    const msg = 'No inspections were conducted in this reporting period.';
    page.drawText(msg, { x: MARGIN, y: y - 11, size: 11, font: helvOblique });
    y -= 14;
    if (storms && storms.length > 0) {
      page.drawText('WARNING: Storm event(s) occurred but no post-storm inspection was logged.',
        { x: MARGIN, y: y - 10, size: 10, font: helvBold, color: rgb(0.7, 0, 0) });
    }
  } else {
    page.drawText(`${inspections.length} inspection${inspections.length > 1 ? 's' : ''} conducted in this period:`,
      { x: MARGIN, y: y - 11, size: 11, font: helvBold });
    y -= 16;
    for (const i of inspections) {
      page.drawText(`  • ${i.inspection_date} — ${i.inspection_type.replace('_', ' ')} — ${i.inspector_name} — ${i.status}`,
        { x: MARGIN, y: y - 10, size: 10, font: helv });
      y -= 12;
    }
  }

  // Footer
  page.drawText(`Generated ${new Date().toLocaleString()}`, {
    x: MARGIN, y: 30, size: 8, font: helv, color: rgb(0.5, 0.5, 0.5)
  });

  return await pdf.save();
}

// === helpers ===
function drawBmpTable(page, pdf, helv, helvBold, findings, getY, setY) {
  const colWidths = [25, 200, 60, 70, 175];
  let y = getY();
  // Header
  let x = MARGIN;
  const headers = ['#', 'BMP', 'Installed?', 'Maint Req?', 'Notes'];
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], { x: x + 2, y: y - 9, size: 8, font: helvBold });
    x += colWidths[i];
  }
  y -= 12;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.3, color: rgb(0.6, 0.6, 0.6) });
  y -= 4;
  // Rows
  for (const f of findings) {
    const cells = [
      String(f.bmp?.bmp_number || ''),
      `${f.bmp?.bmp_code ? f.bmp.bmp_code + ' ' : ''}${f.bmp?.bmp_name || ''}`,
      f.installed === true ? 'Yes' : f.installed === false ? 'No' : '—',
      f.maintenance_required === true ? 'Yes' : f.maintenance_required === false ? 'No' : '—',
      f.notes || ''
    ];
    // Compute max line wrap height for this row
    let maxLines = 1;
    for (let i = 0; i < cells.length; i++) {
      const lines = wrapText(cells[i], helv, 8, colWidths[i] - 4);
      if (lines.length > maxLines) maxLines = lines.length;
    }
    const rowH = maxLines * 11 + 4;

    if (y - rowH < MARGIN) {
      // Page break
      const newPage = pdf.addPage([PAGE_W, PAGE_H]);
      Object.assign(page, newPage);
      y = PAGE_H - MARGIN;
    }

    x = MARGIN;
    for (let i = 0; i < cells.length; i++) {
      const lines = wrapText(cells[i], helv, 8, colWidths[i] - 4);
      let yy = y;
      for (const line of lines) {
        page.drawText(line, { x: x + 2, y: yy - 8, size: 8, font: helv });
        yy -= 11;
      }
      x += colWidths[i];
    }
    y -= rowH;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.2, color: rgb(0.85, 0.85, 0.85) });
    y -= 2;
  }
  setY(y);
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    const w = font.widthOfTextAtSize(test, size);
    if (w > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

function safe(v) { return v == null || v === '' ? '—' : String(v); }
function formatDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-US');
  } catch { return String(d); }
}
