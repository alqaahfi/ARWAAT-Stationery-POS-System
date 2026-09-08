const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const MM_TO_PT = 2.83465;
const mm = (n) => n * MM_TO_PT;

const TEXT_COLOR = rgb(0.07, 0.09, 0.15);
const MUTED_COLOR = rgb(0.4, 0.44, 0.52);
const BORDER_COLOR = rgb(0, 0, 0); // visible black grid lines, as requested
const HEADER_FILL = rgb(0.9, 0.9, 0.9);
const TOTAL_FILL = rgb(0.87, 0.87, 0.87);

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
  const { sale, items, showDues, outstandingBalance } = data;
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
  const marginBottom = mm(marginBottomMm ?? 25);
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

  function centerText(str, yPos, { size = 9, bold = false, color = MUTED_COLOR } = {}) {
    const activeFont = bold ? fontBold : font;
    const value = String(str);
    const textWidth = activeFont.widthOfTextAtSize(value, size);
    page.drawText(value, { x: pageWidth / 2 - textWidth / 2, y: yPos, size, font: activeFont, color });
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

    text('BILL TO', leftX, ly, { size: 8, bold: true, color: MUTED_COLOR });
    text('INVOICE DETAILS', rightColX, ly, { size: 8, bold: true, color: MUTED_COLOR });
    ly -= lineH;
    text(sale.customer_name || 'Walk-in Customer', leftX, ly, { size: 11, bold: true, maxWidth: midX - leftX - 10 });
    text(`Invoice No: ${sale.invoice_no}`, rightColX, ly, { size: 9 });
    ly -= lineH;
    text(sale.customer_phone || '—', leftX, ly, { size: 9, color: MUTED_COLOR });
    text(`Date & Time: ${formatDate(sale.created_at)}`, rightColX, ly, { size: 9 });
    ly -= lineH;
    if (sale.customer_address) {
      text(sale.customer_address, leftX, ly, { size: 9, color: MUTED_COLOR, maxWidth: midX - leftX - 10 });
    }
    text(`Cashier: ${sale.cashier_name}`, rightColX, ly, { size: 9 });

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
  function drawItemRow(item) {
    const [x0, x1, x2, x3, x4] = colBounds;
    const rowTop = y;
    const rowBottom = y - rowHeight;

    page.drawRectangle({ x: x0, y: rowBottom, width: x4 - x0, height: rowHeight, borderColor: BORDER_COLOR, borderWidth: 0.75 });
    vLine(x1, rowTop, rowBottom);
    vLine(x2, rowTop, rowBottom);
    vLine(x3, rowTop, rowBottom);

    const label =
      item.variant_name && item.variant_name !== 'Standard' ? `${item.product_name} (${item.variant_name})` : item.product_name;
    const textY = rowBottom + 5;
    text(label, x0 + 6, textY, { size: 9, maxWidth: x1 - x0 - 10 });
    text(`${item.quantity} ${item.unit_name}`, x1 + 6, textY, { size: 9, maxWidth: x2 - x1 - 10 });
    text(money(item.unit_price), x3 - 6, textY, { size: 9, align: 'right' });
    text(money(item.line_total), x4 - 6, textY, { size: 9, align: 'right' });

    y = rowBottom;
  }

  await startNewPage();
  drawInfoBox();
  drawTableHeaderRow();

  // -------- item rows, paginating onto a fresh copy of the template as needed --------
  for (const item of items) {
    if (y - rowHeight < marginBottom) {
      await startNewPage();
      drawTableHeaderRow();
    }
    drawItemRow(item);
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
      label: 'Total Outstanding Balance',
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

  // Footer applies independently of whichever header this invoice used — the
  // letterhead image (if any) only ever covers the header area, so this runs
  // the same way whether or not a letterhead is set.
  const footerLines = (settings.receipt_footer_text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (footerLines.length > 0) {
    const footerLineHeight = 13;
    const footerHeight = footerLines.length * footerLineHeight + 20;
    if (y - footerHeight < marginBottom) {
      await startNewPage();
    }
    y -= 20;
    footerLines.forEach((line, i) => centerText(line, y - i * footerLineHeight));
  }

  return outputDoc.save();
}

module.exports = { buildMergedInvoicePdf };
