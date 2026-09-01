const fs = require('fs');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const MM_TO_PT = 2.83465;
const mm = (n) => n * MM_TO_PT;

const TEXT_COLOR = rgb(0.07, 0.09, 0.15);
const MUTED_COLOR = rgb(0.4, 0.44, 0.52);
const LINE_COLOR = rgb(0.1, 0.1, 0.1);

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
  const rowHeight = 16;
  const reservedForTotals = 150; // pts — never let the totals block get split across a page break

  let page = null;
  let pageWidth = 0;
  let pageHeight = 0;
  let rightX = 0;
  let y = 0;

  async function startNewPage() {
    const [copied] = await outputDoc.copyPages(templateDoc, [0]);
    outputDoc.addPage(copied);
    page = copied;
    const size = page.getSize();
    pageWidth = size.width;
    pageHeight = size.height;
    rightX = pageWidth - marginX;
    y = pageHeight - marginTop;
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

  function drawTableHeader() {
    text('Item', marginX, y, { bold: true, size: 9 });
    text('Qty', marginX + 240, y, { bold: true, size: 9 });
    text('Unit Price', rightX - 130, y, { bold: true, size: 9, align: 'right' });
    text('Total', rightX, y, { bold: true, size: 9, align: 'right' });
    y -= 8;
    page.drawLine({ start: { x: marginX, y }, end: { x: rightX, y }, thickness: 0.75, color: LINE_COLOR });
    y -= 16;
  }

  await startNewPage();

  // -------- header: Bill To (left) / Invoice No + Date (right) --------
  text('BILL TO', marginX, y, { size: 8, bold: true, color: MUTED_COLOR });
  text('INVOICE NO', rightX, y, { size: 8, bold: true, color: MUTED_COLOR, align: 'right' });
  y -= 15;
  text(sale.customer_name || 'Walk-in Customer', marginX, y, { size: 12, bold: true, maxWidth: pageWidth - marginX - marginX - 140 });
  text(sale.invoice_no, rightX, y, { size: 12, bold: true, align: 'right' });
  y -= 14;
  if (sale.customer_phone) {
    text(sale.customer_phone, marginX, y, { size: 9, color: MUTED_COLOR });
  }
  text(formatDate(sale.created_at), rightX, y, { size: 9, color: MUTED_COLOR, align: 'right' });
  y -= 12;
  if (sale.customer_address) {
    text(sale.customer_address, marginX, y, { size: 9, color: MUTED_COLOR, maxWidth: pageWidth - marginX - marginX });
    y -= 12;
  }

  y -= 18;
  drawTableHeader();

  // -------- item rows, paginating onto a fresh copy of the template as needed --------
  for (const item of items) {
    if (y - rowHeight < marginBottom) {
      await startNewPage();
      drawTableHeader();
    }
    const label =
      item.variant_name && item.variant_name !== 'Standard' ? `${item.product_name} (${item.variant_name})` : item.product_name;
    text(label, marginX, y, { size: 9, maxWidth: 220 });
    text(`${item.quantity} ${item.unit_name}`, marginX + 240, y, { size: 9 });
    text(money(item.unit_price), rightX - 130, y, { size: 9, align: 'right' });
    text(money(item.line_total), rightX, y, { size: 9, align: 'right' });
    y -= rowHeight;
  }

  // -------- totals block — kept together, pushed to a fresh page if it wouldn't fit --------
  if (y - reservedForTotals < marginBottom) {
    await startNewPage();
  }
  y -= 6;
  page.drawLine({ start: { x: rightX - 200, y }, end: { x: rightX, y }, thickness: 0.75, color: LINE_COLOR });
  y -= 16;

  function totalRow(label, value, { bold = false, color = TEXT_COLOR } = {}) {
    const size = bold ? 10 : 9;
    text(label, rightX - 200, y, { size, bold, color });
    text(money(value), rightX, y, { size, bold, color, align: 'right' });
    y -= 15;
  }

  totalRow('Subtotal', sale.subtotal);
  if (sale.discount_amount > 0) totalRow('Discount', -sale.discount_amount);
  totalRow('Total', sale.total_amount, { bold: true });
  totalRow('Paid', sale.paid_amount);
  if (sale.balance_due > 0) totalRow('Balance Due', sale.balance_due, { bold: true });
  if (showDues) totalRow('Total Outstanding Balance', outstandingBalance, { bold: true, color: outstandingBalance < 0 ? rgb(0.02, 0.4, 0.6) : TEXT_COLOR });

  y -= 20;
  text(`Cashier: ${sale.cashier_name}`, marginX, y, { size: 8, color: MUTED_COLOR });

  return outputDoc.save();
}

module.exports = { buildMergedInvoicePdf };
