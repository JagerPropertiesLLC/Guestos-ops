// lib/swpppPdf.js
//
// SWPPP Inspection Report PDF — visually mirrors the EPA standard inspection report
// (Appendix B from the EPA SWPPP Guide). Uses pdf-lib for serverless compatibility.
//
// Layout follows the uploaded reference form:
//   1. Title header
//   2. General Information table (4-column grid, label/value pairs)
//   3. Type of Inspection row (4 checkbox options)
//   4. Weather Information section
//   5. Discharges section
//   6. Site-specific BMPs table (#, BMP, Installed?, Maint Req?, Corrective Action Notes)
//   7. Overall Site Issues table (same column structure)
//   8. Non-compliance free-text
//   9. Certification statement + signature

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612;     // US Letter width in points (8.5")
const PAGE_H = 792;     // US Letter height (11")
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const BORDER = rgb(0, 0, 0);
const HEADER_BG = rgb(0.85, 0.85, 0.85);
const TEXT = rgb(0, 0, 0);
const MUTED = rgb(0.15, 0.15, 0.15);

export async function buildInspectionPdf({ inspection, bmpFindings, siteCheckFindings, correctiveActions, signatureImageBytes }) {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Embed signature image if provided
  let signatureImage = null;
  if (signatureImageBytes) {
    try {
      signatureImage = await pdf.embedPng(signatureImageBytes);
    } catch (e) {
      // If PNG fails, try JPG
      try {
        signatureImage = await pdf.embedJpg(signatureImageBytes);
      } catch (e2) {
        console.error('[swppp pdf] Signature embed failed, using text fallback:', e2.message);
      }
    }
  }

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const proj = inspection.swppp_project?.project || {};

  // ---- helpers ----
  function newPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  }
  function need(h) {
    if (y - h < MARGIN) newPage();
  }
  function drawText(str, x, yPos, opts = {}) {
    const size = opts.size ?? 9;
    const font = opts.font ?? helv;
    let s = String(str ?? '');
    if (opts.maxWidth) {
      s = truncateToWidth(s, font, size, opts.maxWidth);
    }
    page.drawText(s, {
      x, y: yPos,
      size,
      font,
      color: opts.color ?? TEXT
    });
  }
  function drawCenteredText(str, yPos, opts = {}) {
    const size = opts.size ?? 9;
    const font = opts.font ?? helv;
    const w = font.widthOfTextAtSize(String(str ?? ''), size);
    drawText(str, (PAGE_W - w) / 2, yPos, opts);
  }
  function drawRect(x, yPos, w, h, opts = {}) {
    page.drawRectangle({
      x, y: yPos, width: w, height: h,
      borderColor: opts.borderColor ?? BORDER,
      borderWidth: opts.borderWidth ?? 0.5,
      color: opts.color
    });
  }

  // ============ TITLE ============
  drawCenteredText('Stormwater Construction Site Inspection Report', y - 14, { size: 14, font: bold });
  y -= 22;

  // ============ TABLE 0: GENERAL INFORMATION ============
  // Section header bar
  const sectionBarH = 16;
  drawRect(MARGIN, y - sectionBarH, CONTENT_W, sectionBarH, { color: HEADER_BG });
  drawText('General Information', MARGIN + 6, y - 11, { size: 10, font: bold });
  y -= sectionBarH;

  // Build the table as a 4-column grid mirroring the form. Some rows span 4 cells, some are 2x2.
  // Column widths sum to CONTENT_W (532 pts). EPA form: ~25%, 25%, 25%, 25%.
  const colW = CONTENT_W / 4;

  // Helper to draw a labeled row. variant:
  //   'full': single full-width row, label takes col 0, value spans cols 1-3
  //   'split': two pairs - label1/value1 in cols 0-1, label2/value2 in cols 2-3
  //   'fullspan': label is in col 0, value spans the rest
  function drawGenInfoRow(variant, items, rowH = 18) {
    need(rowH + 2);
    const yTop = y;
    const yBot = y - rowH;

    if (variant === 'fullspan') {
      // 1 label + 1 value spanning 3 cols
      const [{ label, value }] = items;
      drawRect(MARGIN, yBot, colW, rowH);                    // label cell
      drawRect(MARGIN + colW, yBot, colW * 3, rowH);          // value cell (spanning 3)
      drawText(label, MARGIN + 4, yBot + 6, { size: 8, font: bold });
      drawText(value, MARGIN + colW + 4, yBot + 6, { size: 9, maxWidth: colW * 3 - 8 });
    } else if (variant === 'split') {
      // 2 label/value pairs side by side
      const [a, b] = items;
      drawRect(MARGIN, yBot, colW, rowH);                    // label A
      drawRect(MARGIN + colW, yBot, colW, rowH);             // value A
      drawRect(MARGIN + colW * 2, yBot, colW, rowH);         // label B
      drawRect(MARGIN + colW * 3, yBot, colW, rowH);         // value B
      drawText(a.label, MARGIN + 4, yBot + 6, { size: 8, font: bold });
      drawText(a.value, MARGIN + colW + 4, yBot + 6, { size: 9, maxWidth: colW - 8 });
      drawText(b.label, MARGIN + colW * 2 + 4, yBot + 6, { size: 8, font: bold });
      drawText(b.value, MARGIN + colW * 3 + 4, yBot + 6, { size: 9, maxWidth: colW - 8 });
    } else if (variant === 'full4') {
      // single label spanning all 4 cells (used for "Type of Inspection" with checkboxes inline)
      drawRect(MARGIN, yBot, CONTENT_W, rowH);
      drawText(items[0].label, MARGIN + 4, yBot + 6, { size: 8, font: bold });
      // "value" string drawn after the label
      drawText(items[0].value, MARGIN + 110, yBot + 6, { size: 9 });
    }
    y -= rowH;
  }

  drawGenInfoRow('fullspan', [{ label: 'Project Name', value: safe(proj.name) }]);
  drawGenInfoRow('split', [
    { label: 'NPDES Tracking No.', value: safe(inspection.swppp_project?.cdps_permit_number) },
    { label: 'Location', value: safe(proj.address) }
  ]);
  drawGenInfoRow('split', [
    { label: 'Date of Inspection', value: formatDate(inspection.inspection_date) },
    { label: 'Start/End Time', value: `${safe(inspection.start_time)} / ${safe(inspection.end_time)}` }
  ]);
  drawGenInfoRow('fullspan', [{ label: "Inspector's Name(s)", value: safe(inspection.inspector_name) }]);
  drawGenInfoRow('fullspan', [{ label: "Inspector's Title(s)", value: safe(inspection.inspector_title) }]);
  drawGenInfoRow('fullspan', [{ label: "Inspector's Contact Info", value: safe(inspection.inspector_contact) }]);
  drawGenInfoRow('fullspan', [{ label: "Inspector's Qualifications", value: safe(inspection.inspector_qualifications) }]);
  drawGenInfoRow('fullspan', [{ label: 'Phase of Construction', value: safe(inspection.construction_phase_description) }]);

  // Type of Inspection row — checkboxes inline
  const typeStr =
    `${cb(inspection.inspection_type === 'regular')} Regular   ` +
    `${cb(inspection.inspection_type === 'pre_storm')} Pre-storm event   ` +
    `${cb(inspection.inspection_type === 'during_storm')} During storm event   ` +
    `${cb(inspection.inspection_type === 'post_storm')} Post-storm event`;
  drawGenInfoRow('full4', [{ label: 'Type of Inspection:', value: typeStr }]);

  // ============ WEATHER INFORMATION header ============
  need(sectionBarH);
  drawRect(MARGIN, y - sectionBarH, CONTENT_W, sectionBarH, { color: HEADER_BG });
  drawText('Weather Information', MARGIN + 6, y - 11, { size: 10, font: bold });
  y -= sectionBarH;

  // Storm event row
  const stormRowH = 32;
  need(stormRowH + 2);
  drawRect(MARGIN, y - stormRowH, CONTENT_W, stormRowH);
  drawText('Has there been a storm event since the last inspection?', MARGIN + 4, y - 11, { size: 8, font: bold });
  drawText(
    `${cb(inspection.storm_since_last_inspection)} Yes   ${cb(!inspection.storm_since_last_inspection)} No`,
    MARGIN + 280, y - 11, { size: 9 }
  );
  if (inspection.storm_since_last_inspection) {
    drawText(
      `If yes:  Storm Start: ${safe(inspection.storm_start_at)}   Duration (hrs): ${safe(inspection.storm_duration_hours)}   Precip (in): ${safe(inspection.storm_precipitation_inches)}`,
      MARGIN + 4, y - 25, { size: 8 }
    );
  } else {
    drawText('If yes, provide:  Storm Start Date & Time:           Storm Duration (hrs):           Approximate Amount of Precipitation (in):',
      MARGIN + 4, y - 25, { size: 7, color: MUTED });
  }
  y -= stormRowH;

  // Weather at time of inspection
  const weatherRowH = 32;
  need(weatherRowH + 2);
  drawRect(MARGIN, y - weatherRowH, CONTENT_W, weatherRowH);
  drawText('Weather at time of this inspection?', MARGIN + 4, y - 11, { size: 8, font: bold });
  const wxStr =
    `${cb(inspection.weather_clear)} Clear   ` +
    `${cb(inspection.weather_cloudy)} Cloudy   ` +
    `${cb(inspection.weather_rain)} Rain   ` +
    `${cb(inspection.weather_sleet)} Sleet   ` +
    `${cb(inspection.weather_fog)} Fog   ` +
    `${cb(inspection.weather_snowing)} Snowing   ` +
    `${cb(inspection.weather_high_winds)} High Winds`;
  drawText(wxStr, MARGIN + 4, y - 22, { size: 8 });
  drawText(`Other: ${safe(inspection.weather_other)}      Temperature: ${safe(inspection.weather_temp_f)}°F`,
    MARGIN + 320, y - 22, { size: 8 });
  y -= weatherRowH;

  // Discharges since last
  const dis1H = 22;
  need(dis1H + 2);
  drawRect(MARGIN, y - dis1H, CONTENT_W, dis1H);
  drawText('Have any discharges occurred since the last inspection?',
    MARGIN + 4, y - 9, { size: 8, font: bold });
  drawText(
    `${cb(inspection.discharges_since_last)} Yes   ${cb(!inspection.discharges_since_last)} No`,
    MARGIN + 290, y - 9, { size: 9 }
  );
  drawText(
    inspection.discharges_since_last && inspection.discharges_since_last_description
      ? `If yes: ${inspection.discharges_since_last_description}`
      : 'If yes, describe:',
    MARGIN + 4, y - 19, { size: 7, color: inspection.discharges_since_last_description ? TEXT : MUTED }
  );
  y -= dis1H;

  // Discharges now
  const dis2H = 22;
  need(dis2H + 2);
  drawRect(MARGIN, y - dis2H, CONTENT_W, dis2H);
  drawText('Are there any discharges at the time of inspection?',
    MARGIN + 4, y - 9, { size: 8, font: bold });
  drawText(
    `${cb(inspection.discharges_now)} Yes   ${cb(!inspection.discharges_now)} No`,
    MARGIN + 290, y - 9, { size: 9 }
  );
  drawText(
    inspection.discharges_now && inspection.discharges_now_description
      ? `If yes: ${inspection.discharges_now_description}`
      : 'If yes, describe:',
    MARGIN + 4, y - 19, { size: 7, color: inspection.discharges_now_description ? TEXT : MUTED }
  );
  y -= dis2H;

  // ============ SITE-SPECIFIC BMPs ============
  y -= 8;
  need(20);
  drawText('Site-specific BMPs', MARGIN, y - 11, { size: 11, font: bold });
  y -= 14;
  drawText('Number the structural and non-structural BMPs identified in your SWPPP on your site map and list them below.',
    MARGIN, y - 8, { size: 7, font: oblique, color: TEXT });
  y -= 12;

  // BMP table
  drawBmpTable({
    page, pdf, helv, bold,
    findings: bmpFindings,
    columns: ['', 'BMP', 'BMP Installed?', 'BMP Maintenance Required?', 'Corrective Action Needed and Notes'],
    columnWidths: [22, 130, 80, 90, 210],
    getY: () => y,
    setY: (v) => { y = v; },
    onNewPage: () => { newPage(); },
    yBoundary: () => MARGIN
  });

  // ============ OVERALL SITE ISSUES ============
  y -= 8;
  need(20);
  drawText('Overall Site Issues', MARGIN, y - 11, { size: 11, font: bold });
  y -= 14;
  drawText('Below are some general site issues that should be assessed during inspections. Customize as needed for site conditions.',
    MARGIN, y - 8, { size: 7, font: oblique, color: TEXT });
  y -= 12;

  drawSiteCheckTable({
    page, pdf, helv, bold,
    findings: siteCheckFindings,
    columnWidths: [22, 240, 80, 90, 100],
    getY: () => y,
    setY: (v) => { y = v; },
    onNewPage: () => { newPage(); },
    yBoundary: () => MARGIN
  });

  // ============ NON-COMPLIANCE ============
  y -= 6;
  need(50);
  drawText('Non-Compliance', MARGIN, y - 11, { size: 11, font: bold });
  y -= 14;
  drawRect(MARGIN, y - 36, CONTENT_W, 36);
  drawText('Describe any incidents of non-compliance not described above:',
    MARGIN + 4, y - 10, { size: 8, font: bold });
  if (inspection.non_compliance_notes) {
    drawText(inspection.non_compliance_notes, MARGIN + 4, y - 24, {
      size: 9,
      maxWidth: CONTENT_W - 8
    });
  }
  y -= 36;

  // ============ CERTIFICATION ============
  y -= 6;
  need(110);
  drawText('CERTIFICATION STATEMENT', MARGIN, y - 11, { size: 10, font: bold });
  y -= 14;
  const certText = '"I certify under penalty of law that this document and all attachments were prepared under my direction or supervision in accordance with a system designed to assure that qualified personnel properly gathered and evaluated the information submitted. Based on my inquiry of the person or persons who manage the system, or those persons directly responsible for gathering the information, the information submitted is, to the best of my knowledge and belief, true, accurate, and complete. I am aware that there are significant penalties for submitting false information, including the possibility of fine and imprisonment for knowing violations."';
  const certLines = wrap(certText, helv, 8, CONTENT_W);
  for (const line of certLines) {
    need(11);
    drawText(line, MARGIN, y - 8, { size: 8 });
    y -= 10;
  }
  y -= 4;

  // ============ SIGNATURE BLOCK ============
  // Layout (top to bottom):
  //   Print Name | Title | Date    (values, then underlines, then italic labels)
  //   [signature image]
  //   ----------- signature line, snug under image
  //   Signature (italic label below line)

  // Extra breathing room above the Print Name row to separate from cert statement
  y -= 22;

  // Print Name / Title / Date row first
  const colSpacing = CONTENT_W / 3;
  const printName = safe(inspection.certified_by_name);
  const printTitle = safe(inspection.certified_by_title);
  const printDate = formatDate(inspection.certified_at);

  need(34);
  drawText(printName,  MARGIN + 8,                   y - 9, { size: 10 });
  drawText(printTitle, MARGIN + colSpacing + 8,      y - 9, { size: 10 });
  drawText(printDate,  MARGIN + colSpacing * 2 + 8,  y - 9, { size: 10 });
  y -= 14;

  page.drawLine({ start: { x: MARGIN + 4,                  y }, end: { x: MARGIN + colSpacing - 8, y },     thickness: 0.5, color: TEXT });
  page.drawLine({ start: { x: MARGIN + colSpacing + 4,     y }, end: { x: MARGIN + colSpacing * 2 - 8, y }, thickness: 0.5, color: TEXT });
  page.drawLine({ start: { x: MARGIN + colSpacing * 2 + 4, y }, end: { x: MARGIN + colSpacing * 3 - 8, y }, thickness: 0.5, color: TEXT });
  y -= 4;

  drawText('Print Name', MARGIN + 8,                  y - 8, { size: 8, font: oblique, color: MUTED });
  drawText('Title',      MARGIN + colSpacing + 8,     y - 8, { size: 8, font: oblique, color: MUTED });
  drawText('Date',       MARGIN + colSpacing * 2 + 8, y - 8, { size: 8, font: oblique, color: MUTED });
  y -= 10;

  // Signature image — 1/2 of previous 107pt = ~54pt
  if (signatureImage) {
    let sigHeight = 54;
    const scaleFactor = sigHeight / signatureImage.height;
    let drawWidth = signatureImage.width * scaleFactor;
    const maxSigWidth = 320;
    if (drawWidth > maxSigWidth) {
      const widthScale = maxSigWidth / drawWidth;
      drawWidth = maxSigWidth;
      sigHeight = sigHeight * widthScale;
    }
    sigHeight = Math.round(sigHeight);

    // Image bottom-edge sits ON the signature line; image draws upward from there.
    // (Signature image is now tightly cropped, no overhang hack needed.)
    const blockHeight = sigHeight + 18;
    if (y - blockHeight < MARGIN) newPage();

    page.drawImage(signatureImage, {
      x: MARGIN + 30,
      y: y - sigHeight,
      width: drawWidth,
      height: sigHeight
    });
    y -= sigHeight + 2;

    // Signature underline
    page.drawLine({
      start: { x: MARGIN + 20, y },
      end: { x: MARGIN + 380, y },
      thickness: 0.7,
      color: TEXT
    });
    y -= 4;
    drawText('Signature', MARGIN + 20, y - 8, { size: 8, font: oblique, color: MUTED });
    y -= 12;
  } else if (inspection.signature_data) {
    if (y - 40 < MARGIN) newPage();
    drawText(`/s/ ${safe(inspection.certified_by_name)}`, MARGIN + 30, y - 14, { size: 14, font: oblique });
    y -= 18;
    page.drawLine({ start: { x: MARGIN + 20, y }, end: { x: MARGIN + 380, y }, thickness: 0.7 });
    y -= 4;
    drawText('Signature', MARGIN + 20, y - 8, { size: 8, font: oblique, color: MUTED });
    y -= 12;
  } else {
    if (y - 40 < MARGIN) newPage();
    page.drawLine({ start: { x: MARGIN + 20, y: y - 30 }, end: { x: MARGIN + 380, y: y - 30 }, thickness: 0.7 });
    y -= 34;
    drawText('Signature', MARGIN + 20, y - 8, { size: 8, font: oblique, color: MUTED });
    y -= 12;
  }

  return await pdf.save();
}

// ============ BMP TABLE ============
function drawBmpTable({ page: pageRef, pdf, helv, bold, findings, columns, columnWidths, getY, setY, onNewPage, yBoundary }) {
  let page = pageRef;
  let y = getY();
  const x0 = 40;
  const totalW = columnWidths.reduce((s, w) => s + w, 0);
  const headerH = 26;

  // Header row
  page.drawRectangle({ x: x0, y: y - headerH, width: totalW, height: headerH, color: rgb(0.85, 0.85, 0.85), borderColor: rgb(0,0,0), borderWidth: 0.5 });
  let cx = x0;
  for (let i = 0; i < columns.length; i++) {
    page.drawRectangle({ x: cx, y: y - headerH, width: columnWidths[i], height: headerH, borderColor: rgb(0,0,0), borderWidth: 0.5 });
    const lines = wrap(columns[i], bold, 8, columnWidths[i] - 4);
    let ty = y - 8;
    for (const ln of lines) {
      page.drawText(ln, { x: cx + 3, y: ty - 4, size: 8, font: bold });
      ty -= 9;
    }
    cx += columnWidths[i];
  }
  y -= headerH;

  // Data rows — show all findings, then pad to 20 rows like the EPA form
  const TARGET_ROWS = 10;
  const filledFindings = findings || [];
  for (let i = 0; i < TARGET_ROWS; i++) {
    if (y - 18 < yBoundary()) {
      onNewPage();
      page = pdf.getPages()[pdf.getPages().length - 1];
      y = 792 - 40;
    }
    const f = filledFindings[i];
    const rowH = 18;
    const cells = [
      String(i + 1),
      f ? `${f.bmp?.bmp_code ? f.bmp.bmp_code + ' (' + f.bmp.bmp_name + ')' : f.bmp?.bmp_name || ''}` : '',
      f ? `${f.installed === true ? '[X]' : '[  ]'} Yes  ${f.installed === false ? '[X]' : '[  ]'} No` : '[  ] Yes  [  ] No',
      f ? `${f.maintenance_required === true ? '[X]' : '[  ]'} Yes  ${f.maintenance_required === false ? '[X]' : '[  ]'} No` : '[  ] Yes  [  ] No',
      f ? (f.notes || '') : ''
    ];
    let cellX = x0;
    for (let c = 0; c < cells.length; c++) {
      page.drawRectangle({ x: cellX, y: y - rowH, width: columnWidths[c], height: rowH, borderColor: rgb(0,0,0), borderWidth: 0.3 });
      const lines = wrap(cells[c], helv, 8, columnWidths[c] - 4);
      let ty = y - 6;
      for (const ln of lines.slice(0, 2)) {
        page.drawText(ln, { x: cellX + 3, y: ty - 4, size: 8, font: helv });
        ty -= 9;
      }
      cellX += columnWidths[c];
    }
    y -= rowH;
  }
  setY(y);
}

// ============ SITE CHECKS TABLE ============
function drawSiteCheckTable({ page: pageRef, pdf, helv, bold, findings, columnWidths, getY, setY, onNewPage, yBoundary }) {
  let page = pageRef;
  let y = getY();
  const x0 = 40;
  const totalW = columnWidths.reduce((s, w) => s + w, 0);
  const headerH = 26;
  const cols = ['', 'BMP/activity', 'Implemented?', 'Maintenance Required?', 'Corrective Action Needed and Notes'];

  // Header
  page.drawRectangle({ x: x0, y: y - headerH, width: totalW, height: headerH, color: rgb(0.85, 0.85, 0.85), borderColor: rgb(0,0,0), borderWidth: 0.5 });
  let cx = x0;
  for (let i = 0; i < cols.length; i++) {
    page.drawRectangle({ x: cx, y: y - headerH, width: columnWidths[i], height: headerH, borderColor: rgb(0,0,0), borderWidth: 0.5 });
    const lines = wrap(cols[i], bold, 8, columnWidths[i] - 4);
    let ty = y - 8;
    for (const ln of lines) {
      page.drawText(ln, { x: cx + 3, y: ty - 4, size: 8, font: bold });
      ty -= 9;
    }
    cx += columnWidths[i];
  }
  y -= headerH;

  // Data rows — one per site check
  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const question = f.site_check?.check_question || '';
    const isApplicable = f.site_check?.applicable !== false;

    const qLines = wrap(question, helv, 7, columnWidths[1] - 4);
    const noteLines = wrap(f.notes || '', helv, 7, columnWidths[4] - 4);
    const rowH = Math.max(20, Math.max(qLines.length * 9, noteLines.length * 9) + 6);

    if (y - rowH < yBoundary()) {
      onNewPage();
      page = pdf.getPages()[pdf.getPages().length - 1];
      y = 792 - 40;
    }

    const yesCol = !isApplicable ? '' : `${f.passing === true ? '[X]' : '[  ]'} Yes  ${f.passing === false ? '[X]' : '[  ]'} No`;
    const maintCol = !isApplicable ? '' : `${f.maintenance_required === true ? '[X]' : '[  ]'} Yes  ${f.maintenance_required === false ? '[X]' : '[  ]'} No`;
    const notesCol = !isApplicable ? 'N/A' : (f.notes || '');

    const cells = [
      String(f.site_check?.check_number || (i + 1)),
      question,
      yesCol,
      maintCol,
      notesCol
    ];
    let cellX = x0;
    for (let c = 0; c < cells.length; c++) {
      page.drawRectangle({ x: cellX, y: y - rowH, width: columnWidths[c], height: rowH, borderColor: rgb(0,0,0), borderWidth: 0.3 });
      const lines = wrap(cells[c], helv, 7, columnWidths[c] - 4);
      let ty = y - 4;
      for (const ln of lines) {
        page.drawText(ln, { x: cellX + 3, y: ty - 4, size: 7, font: helv });
        ty -= 9;
      }
      cellX += columnWidths[c];
    }
    y -= rowH;
  }
  setY(y);
}

// ============ WEEKLY REPORT PDF (unchanged from previous, kept for compatibility) ============
export async function buildWeeklyReportPdf({ report, storms, inspections }) {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const proj = report.swppp_project?.project || {};

  page.drawText('SWPPP Weekly Report', { x: MARGIN, y: y - 18, size: 18, font: bold });
  y -= 26;
  page.drawText(safe(proj.name), { x: MARGIN, y: y - 12, size: 12, font: helv });
  y -= 16;
  page.drawText(safe(proj.address), { x: MARGIN, y: y - 10, size: 10, font: helv, color: MUTED });
  y -= 24;

  page.drawText('Reporting Period', { x: MARGIN, y: y - 11, size: 11, font: bold });
  y -= 14;
  page.drawText(`${report.period_start} through ${report.period_end}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 22;

  page.drawText('Summary', { x: MARGIN, y: y - 11, size: 11, font: bold });
  y -= 14;
  page.drawText(`Inspections conducted: ${report.inspection_count}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 12;
  page.drawText(`Storm events triggering threshold: ${report.storm_event_count}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 12;
  page.drawText(`Open corrective actions (project total): ${report.open_corrective_actions_count}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 22;

  page.drawText('Permit Information', { x: MARGIN, y: y - 11, size: 11, font: bold });
  y -= 14;
  page.drawText(`CDPS Permit: ${safe(report.swppp_project?.cdps_permit_number)}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 12;
  page.drawText(`MS4 Authority: ${safe(report.swppp_project?.ms4_authority)}`, { x: MARGIN, y: y - 10, size: 10, font: helv });
  y -= 22;

  if (storms && storms.length > 0) {
    page.drawText('Storm Events This Period', { x: MARGIN, y: y - 11, size: 11, font: bold });
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
    page.drawText('No inspections were conducted in this reporting period.', { x: MARGIN, y: y - 11, size: 11, font: oblique });
    y -= 14;
    if (storms && storms.length > 0) {
      page.drawText('WARNING: Storm event(s) occurred but no post-storm inspection was logged.',
        { x: MARGIN, y: y - 10, size: 10, font: bold, color: rgb(0.7, 0, 0) });
    }
  } else {
    page.drawText(`${inspections.length} inspection${inspections.length > 1 ? 's' : ''} conducted in this period:`,
      { x: MARGIN, y: y - 11, size: 11, font: bold });
    y -= 16;
    for (const i of inspections) {
      page.drawText(`  • ${i.inspection_date} — ${i.inspection_type.replace('_', ' ')} — ${i.inspector_name} — ${i.status}`,
        { x: MARGIN, y: y - 10, size: 10, font: helv });
      y -= 12;
    }
  }

  page.drawText(`Generated ${new Date().toLocaleString()}`, {
    x: MARGIN, y: 30, size: 8, font: helv, color: MUTED
  });

  return await pdf.save();
}

// ============ HELPERS ============
function cb(checked) { return checked ? '[X]' : '[  ]'; }  // bracketed box that renders in WinAnsi
function wrap(text, font, size, maxWidth) {
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
function safe(v) { return v == null || v === '' ? '' : String(v); }
function truncateToWidth(text, font, size, maxWidth) {
  const s = String(text || '');
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const candidate = s.slice(0, mid) + '...';
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? s.slice(0, lo) + '...' : '';
}
function formatDate(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-US');
  } catch { return String(d); }
}
