const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { BRANDING_LINE } = require('../../shared/branding');

const MM_TO_PT = 2.83465;
const mm = (n) => n * MM_TO_PT;

const TEXT_COLOR = rgb(0.07, 0.09, 0.15);
const MUTED_COLOR = rgb(0.4, 0.44, 0.52);
const BORDER_COLOR = rgb(0, 0, 0); // visible black grid lines, as requested
const HEADER_FILL = rgb(0.9, 0.9, 0.9);
const TOTAL_FILL = rgb(0.87, 0.87, 0.87);

// The fixed ARWAAT credit line on every page (src/shared/branding.js).
const BRANDING_SIZE = 7;
const BRANDING_COLOR = rgb(0.55, 0.55, 0.55);
const BRANDING_BASELINE_MM = 6;
const MIN_BOTTOM_MARGIN_MM = 12;

function formatDate(sqliteDateTime) {
  if (!sqliteDateTime) return '';
  const date = new Date(sqliteDateTime.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return sqliteDateTime;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Stamps a sale's invoice content — as real vector text, not a flattened
// image — directly onto the admin's own uploaded PDF page (repeated once per
// page needed, if the item list runs long enough to overflow one page).
// `data` is the shared buildReceiptData() shape: { sale, items, showDues,
// outstandingBalance }. Returns the merged PDF as a Uint8Array.
async function buildMergedInvoicePdf({ templatePath, data, settings, marginTopMm, marginBottomMm }) {
  const { sale, showDues, outstandingBalance } = data;
  // Purchase receipts reuse this layout with their own wording.
  const labels = { party: 'BILL TO', details: 'INVOICE DETAILS', number: 'Invoice No', by: 'Cashier', outstanding: 'Total Outstanding Balance', ...(data.labels || {}) };
  const currency = settings.currency_symbol || 'Rs.';
  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;

  const templateBytes = fs.readFileSync(templatePath);
  const templateDoc = await PDFDocument.load(templateBytes);
  if (templateDoc.getPageCount() === 0) {
    throw new Error('The letterhead PDF template has no pages.');
  }

  const outputDoc = await PDFDocument.create();
  const font = await outputDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await outputDoc.embedFont(StandardFonts.HelveticaBold);

  const marginTop = mm(marginTopMm ?? 40);
  // Content always stops at least 12 mm above the bottom edge, so it never
  // reaches the ARWAAT line stamped 6 mm up on every page (see below).
  const marginBottom = mm(Math.max(marginBottomMm ?? 25, MIN_BOTTOM_MARGIN_MM));
  const marginX = mm(20);
  const infoBoxHeight = 76;
  const headerRowHeight = 20;
  const rowHeight = 18;
  const reservedForTotals = 170; // pts — never let the totals block get split across a page break

  let page = null;
  let pageWidth = 0;
  let pageHeight = 0;
  let rightX = 0;
  let y = 0;

  // Item table column boundaries: [Item | Qty | Unit Price | Total].
  // Recomputed whenever a page starts, alongside marginX/rightX.
  let colBounds = [0, 0, 0, 0, 0];

  function computeColumns() {
    const tableWidth = rightX - marginX;
    const x0 = marginX;
    const x1 = x0 + tableWidth * 0.46; // end Item / start Qty
    const x2 = x1 + tableWidth * 0.15; // end Qty / start Unit Price
    const x3 = x2 + tableWidth * 0.2; // end Unit Price / start Total
    const x4 = rightX; // end Total
    colBounds = [x0, x1, x2, x3, x4];
  }

  async function startNewPage() {
    const [copied] = await outputDoc.copyPages(templateDoc, [0]);
    outputDoc.addPage(copied);
    page = copied;
    const size = page.getSize();
    pageWidth = size.width;
    pageHeight = size.height;
    rightX = pageWidth - marginX;
    y = pageHeight - marginTop;
    computeColumns();
  }

  function text(str, x, yPos, { size = 9, bold = false, color = TEXT_COLOR, align = 'left', maxWidth } = {}) {
    let value = String(str);
    const activeFont = bold ? fontBold : font;
    if (maxWidth) {
      while (value.length > 1 && activeFont.widthOfTextAtSize(value, size) > maxWidth) {
        value = value.slice(0, -1);
      }
    }
    const drawX = align === 'right' ? x - activeFont.widthOfTextAtSize(value, size) : x;
    page.drawText(value, { x: drawX, y: yPos, size, font: activeFont, color });
  }

  function hLine(x1, x2, yPos, thickness = 0.75) {
    page.drawLine({ start: { x: x1, y: yPos }, end: { x: x2, y: yPos }, thickness, color: BORDER_COLOR });
  }
  function vLine(x, y1, y2, thickness = 0.75) {
    page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color: BORDER_COLOR });
  }

  // -------- bordered info block: Bill To / Cashier (left) + Invoice, Date & Time (right) --------
  // Everything essential up front, per a glance at the top of the invoice.
  function drawInfoBox() {
    const boxTop = y;
    const boxBottom = y - infoBoxHeight;
    const midX = marginX + (rightX - marginX) / 2;
    const lineH = 15;

    page.drawRectangle({
      x: marginX,
      y: boxBottom,
      width: rightX - marginX,
      height: infoBoxHeight,
      borderColor: BORDER_COLOR,
      borderWidth: 0.75,
    });
    vLine(midX, boxTop, boxBottom);

    const leftX = marginX + 10;
    const rightColX = midX + 10;
    let ly = boxTop - 16;

    text(labels.party, leftX, ly, { size: 8, bold: true, color: MUTED_COLOR });
    text(labels.details, rightColX, ly, { size: 8, bold: true, color: MUTED_COLOR });
    ly -= lineH;
    text(sale.customer_name || 'Walk-in Customer', leftX, ly, { size: 11, bold: true, maxWidth: midX - leftX - 10 });
    text(`${labels.number}: ${sale.invoice_no}`, rightColX, ly, { size: 9 });
    ly -= lineH;
    text(sale.customer_phone || '—', leftX, ly, { size: 9, color: MUTED_COLOR });
    text(`Date & Time: ${formatDate(sale.created_at)}`, rightColX, ly, { size: 9 });
    ly -= lineH;
    if (sale.customer_address) {
      text(sale.customer_address, leftX, ly, { size: 9, color: MUTED_COLOR, maxWidth: midX - leftX - 10 });
    }
    text(`${labels.by}: ${sale.cashier_name}`, rightColX, ly, { size: 9 });

    y = boxBottom - 18;
  }

  // -------- item table header row (shaded, bordered, repeated on every page) --------
  function drawTableHeaderRow() {
    const [x0, x1, x2, x3, x4] = colBounds;
    const headerTop = y;
    const headerBottom = y - headerRowHeight;

    page.drawRectangle({
      x: x0,
      y: headerBottom,
      width: x4 - x0,
      height: headerRowHeight,
      color: HEADER_FILL,
      borderColor: BORDER_COLOR,
      borderWidth: 0.75,
    });
    vLine(x1, headerTop, headerBottom);
    vLine(x2, headerTop, headerBottom);
    vLine(x3, headerTop, headerBottom);

    const textY = headerBottom + 6;
    text('Item', x0 + 6, textY, { bold: true, size: 9 });
    text('Qty', x1 + 6, textY, { bold: true, size: 9 });
    text('Unit Price', x3 - 6, textY, { bold: true, size: 9, align: 'right' });
    text('Total', x4 - 6, textY, { bold: true, size: 9, align: 'right' });

    y = headerBottom;
  }

  // -------- one bordered item row: [Item | Qty | Unit Price | Total] --------
  // A grouped row: product name on the first line, the "Type-qty / Type-qty"
  // sub-line beneath it (when the product has Types), qty column = total.
  const subLineExtra = 11;
  const heightFor = (group) => (group.variantText ? rowHeight + subLineExtra : rowHeight);

  function drawItemRow(group) {
    const [x0, x1, x2, x3, x4] = colBounds;
    const height = heightFor(group);
    const rowTop = y;
    const rowBottom = y - height;

    page.drawRectangle({ x: x0, y: rowBottom, width: x4 - x0, height, borderColor: BORDER_COLOR, borderWidth: 0.75 });
    vLine(x1, rowTop, rowBottom);
    vLine(x2, rowTop, rowBottom);
    vLine(x3, rowTop, rowBottom);

    const firstLineY = rowTop - 13;
    text(group.product_name, x0 + 6, firstLineY, { size: 9, maxWidth: x1 - x0 - 10 });
    if (group.variantText) {
      text(group.variantText, x0 + 6, firstLineY - subLineExtra, { size: 8, color: MUTED_COLOR, maxWidth: x1 - x0 - 10 });
    }
    text(group.quantityText || `${group.quantity} ${group.unit_name}`, x1 + 6, firstLineY, { size: 9, maxWidth: x2 - x1 - 10 });
    text(money(group.unit_price), x3 - 6, firstLineY, { size: 9, align: 'right' });
    text(money(group.line_total), x4 - 6, firstLineY, { size: 9, align: 'right' });

    y = rowBottom;
  }

  await startNewPage();
  drawInfoBox();
  drawTableHeaderRow();

  // -------- item rows, paginating onto a fresh copy of the template as needed --------
  for (const group of data.groups) {
    if (y - heightFor(group) < marginBottom) {
      await startNewPage();
      drawTableHeaderRow();
    }
    drawItemRow(group);
  }

  // -------- totals block — bordered mini-table, kept together, pushed to a fresh page if it wouldn't fit --------
  if (y - reservedForTotals < marginBottom) {
    await startNewPage();
  }
  y -= 16;

  const totalsWidth = 270;
  const totalsX = rightX - totalsWidth;
  const totalsLabelWidth = totalsWidth * 0.65; // room for the longest label, "Total Outstanding Balance"

  const totalsRows = [{ label: 'Subtotal', value: sale.subtotal }];
  if (sale.discount_amount > 0) totalsRows.push({ label: 'Discount', value: -sale.discount_amount });
  totalsRows.push({ label: 'Total', value: sale.total_amount, bold: true, shaded: true });
  totalsRows.push({ label: 'Paid', value: sale.paid_amount });
  if (sale.balance_due > 0) totalsRows.push({ label: 'Balance Due', value: sale.balance_due, bold: true });
  if (showDues) {
    totalsRows.push({
      label: labels.outstanding,
      value: outstandingBalance,
      bold: true,
      color: outstandingBalance < 0 ? rgb(0.02, 0.4, 0.6) : TEXT_COLOR,
    });
  }

  const totalsBoxTop = y;
  const totalsBoxHeight = totalsRows.length * rowHeight;
  const totalsBoxBottom = totalsBoxTop - totalsBoxHeight;

  // Shading (grand total row) is painted first, so the grid lines drawn next land on top of it.
  totalsRows.forEach((row, i) => {
    if (!row.shaded) return;
    const rowBottom = totalsBoxTop - (i + 1) * rowHeight;
    page.drawRectangle({ x: totalsX, y: rowBottom, width: totalsWidth, height: rowHeight, color: TOTAL_FILL });
  });

  page.drawRectangle({
    x: totalsX,
    y: totalsBoxBottom,
    width: totalsWidth,
    height: totalsBoxHeight,
    borderColor: BORDER_COLOR,
    borderWidth: 0.75,
  });
  vLine(totalsX + totalsLabelWidth, totalsBoxTop, totalsBoxBottom);
  for (let i = 1; i < totalsRows.length; i++) {
    hLine(totalsX, totalsX + totalsWidth, totalsBoxTop - i * rowHeight);
  }

  totalsRows.forEach((row, i) => {
    const rowBottom = totalsBoxTop - (i + 1) * rowHeight;
    const textY = rowBottom + 5;
    const size = row.bold ? 10 : 9;
    text(row.label, totalsX + 8, textY, { size, bold: row.bold, color: row.color || TEXT_COLOR, maxWidth: totalsLabelWidth - 12 });
    text(money(row.value), totalsX + totalsWidth - 8, textY, { size, bold: row.bold, color: row.color || TEXT_COLOR, align: 'right' });
  });

  // No footer text on A4 invoices (it overlapped the bill content). Only the
  // fixed ARWAAT line, small and grey, centered 6 mm above the bottom of every page.
  for (const p of outputDoc.getPages()) {
    const width = font.widthOfTextAtSize(BRANDING_LINE, BRANDING_SIZE);
    p.drawText(BRANDING_LINE, {
      x: (p.getSize().width - width) / 2,
      y: mm(BRANDING_BASELINE_MM),
      size: BRANDING_SIZE,
      font,
      color: BRANDING_COLOR,
    });
  }

  return outputDoc.save();
}

module.exports = { buildMergedInvoicePdf };
