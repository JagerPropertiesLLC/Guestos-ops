// lib/photoReportPdf.js
// Photo report PDF: cover page + chronological grid (2 cols × 3 rows per page).
// Each cell has the image + capture timestamp + caption.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612;        // US Letter
const PAGE_H = 792;
const MARGIN = 40;
const CELL_GAP = 14;
const COLS = 2;
const ROWS = 3;
const HEADER_H = 60;       // header band on each photo page
const FOOTER_H = 24;

const TEXT = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.4, 0.45, 0.55);
const ACCENT = rgb(0.15, 0.23, 0.42);

const cellW = (PAGE_W - MARGIN * 2 - CELL_GAP * (COLS - 1)) / COLS;
const gridH = PAGE_H - MARGIN * 2 - HEADER_H - FOOTER_H;
const cellH = (gridH - CELL_GAP * (ROWS - 1)) / ROWS;
const imageH = cellH - 30;  // reserve 30pt for caption

export async function buildPhotoReportPdf({ title, headerBrand, dateRangeLabel, entitySubtitle, photos }) {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // ----- Cover page -----
  const cover = pdf.addPage([PAGE_W, PAGE_H]);
  cover.drawText(headerBrand, {
    x: MARGIN, y: PAGE_H - MARGIN - 20,
    size: 11, font: bold, color: ACCENT
  });

  cover.drawText(title, {
    x: MARGIN, y: PAGE_H - MARGIN - 90,
    size: 28, font: bold, color: TEXT
  });

  if (entitySubtitle) {
    cover.drawText(entitySubtitle, {
      x: MARGIN, y: PAGE_H - MARGIN - 122,
      size: 14, font: helv, color: MUTED
    });
  }

  cover.drawText(dateRangeLabel, {
    x: MARGIN, y: PAGE_H - MARGIN - 152,
    size: 12, font: helv, color: MUTED
  });

  cover.drawText(`${photos.length} photo${photos.length === 1 ? '' : 's'} · generated ${new Date().toLocaleString()}`, {
    x: MARGIN, y: MARGIN,
    size: 9, font: helv, color: MUTED
  });

  // ----- Photo pages -----
  const perPage = COLS * ROWS;
  for (let i = 0; i < photos.length; i += perPage) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const slice = photos.slice(i, i + perPage);

    // Header band
    page.drawText(headerBrand, {
      x: MARGIN, y: PAGE_H - MARGIN - 14,
      size: 9, font: bold, color: ACCENT
    });
    page.drawText(title, {
      x: MARGIN, y: PAGE_H - MARGIN - 30,
      size: 13, font: bold, color: TEXT
    });
    page.drawText(`${dateRangeLabel}  ·  page ${Math.floor(i / perPage) + 1}`, {
      x: MARGIN, y: PAGE_H - MARGIN - 46,
      size: 9, font: helv, color: MUTED
    });

    // Grid
    for (let idx = 0; idx < slice.length; idx++) {
      const r = Math.floor(idx / COLS);
      const c = idx % COLS;
      const x = MARGIN + c * (cellW + CELL_GAP);
      const yTop = PAGE_H - MARGIN - HEADER_H - r * (cellH + CELL_GAP);
      const yBottom = yTop - cellH;

      const photo = slice[idx];
      let img = null;
      try {
        if (photo.bytes) {
          if (photo.mime === 'image/png') img = await pdf.embedPng(photo.bytes);
          else                            img = await pdf.embedJpg(photo.bytes);
        }
      } catch (e) { /* skip on embed failure */ }

      if (img) {
        const aspect = img.width / img.height;
        const targetW = cellW;
        const targetH = imageH;
        let drawW = targetW, drawH = drawW / aspect;
        if (drawH > targetH) { drawH = targetH; drawW = drawH * aspect; }
        const xCentered = x + (cellW - drawW) / 2;
        const yCentered = yBottom + 30 + (targetH - drawH) / 2;
        page.drawImage(img, { x: xCentered, y: yCentered, width: drawW, height: drawH });
      } else {
        page.drawRectangle({ x, y: yBottom + 30, width: cellW, height: imageH, borderColor: MUTED, borderWidth: 0.5 });
        page.drawText('(image unavailable)', { x: x + 6, y: yBottom + 30 + imageH / 2, size: 9, font: helv, color: MUTED });
      }

      // Caption: timestamp + note (truncated)
      const ts = photo.captured_at ? new Date(photo.captured_at).toLocaleString() : '';
      page.drawText(ts, { x, y: yBottom + 18, size: 8, font: bold, color: TEXT });
      if (photo.caption) {
        page.drawText(truncate(photo.caption, 70), { x, y: yBottom + 6, size: 8, font: helv, color: MUTED });
      }
    }
  }

  return await pdf.save();
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
