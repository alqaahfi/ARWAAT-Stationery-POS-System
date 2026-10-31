const fs = require('fs');
const crypto = require('crypto');
const { getDb } = require('../db/connection');
const { groupReceiptItems } = require('./receiptData');
const { buildMergedInvoicePdf } = require('./pdfInvoiceMerge');
const { renderViewToPdf, thermalWidthMm } = require('./previewDocument');

// POS "Preview": shows the receipt of a bill that is still being typed, WITHOUT saving it.
// The cart is kept only in memory (a short-lived token); nothing is written to the database,
// no invoice number is used and no stock moves. Prices come from the cart the POS already
// priced with the server's price engine; the real save still re-checks every price.

const drafts = new Map(); // token -> { data, expires }
const TTL_MS = 2 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [token, d] of drafts) if (d.expires < now) drafts.delete(token);
}

function settingsMap() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

const num = (v) => Number(v) || 0;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function buildDraftData(payload, callerId) {
  const db = getDb();
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  if (lines.length === 0) return null;

  const customer = payload.customerId ? db.prepare('SELECT id, name, phone, address, assigned_letterhead_id FROM customers WHERE id = ?').get(payload.customerId) : null;
  const cashier = db.prepare('SELECT full_name FROM users WHERE id = ?').get(callerId);
  const now = db.prepare("SELECT datetime('now') AS t").get().t;

  const items = lines.map((l, i) => {
    const quantity = num(l.quantity);
    const unitPrice = num(l.unitPrice);
    return {
      id: i + 1,
      product_id: num(l.productId) || i + 1,
      product_unit_id: num(l.unitId) || i + 1,
      product_name: String(l.productName || 'Item'),
      variant_name: l.variantName || '',
      unit_name: String(l.unitName || ''),
      unit_price: unitPrice,
      quantity,
      line_total: round2(quantity * unitPrice),
    };
  });

  const subtotal = round2(items.reduce((s, it) => s + it.line_total, 0));
  const discount = Math.min(Math.max(0, num(payload.discountAmount)), subtotal);
  const total = Math.max(0, round2(subtotal - discount));
  const paid = Math.min(Math.max(0, num(payload.paidAmount)), total);
  const balanceDue = Math.max(0, round2(total - paid));

  const letterheadId = payload.letterheadId || (customer && customer.assigned_letterhead_id) || null;
  let letterhead = letterheadId ? db.prepare('SELECT * FROM letterheads WHERE id = ?').get(letterheadId) : null;
  if (!letterhead) letterhead = db.prepare('SELECT * FROM letterheads WHERE is_default = 1 LIMIT 1').get() || null;

  const sale = {
    id: 0,
    invoice_no: 'PREVIEW',
    sale_type: payload.saleType || 'retail',
    customer_id: customer ? customer.id : null,
    customer_name: customer ? customer.name : null,
    customer_phone: customer ? customer.phone : null,
    customer_address: customer ? customer.address : null,
    cashier_name: cashier ? cashier.full_name : '',
    created_at: now,
    subtotal,
    discount_amount: discount,
    total_amount: total,
    paid_amount: paid,
    balance_due: balanceDue,
    payment_status: balanceDue > 0 ? (paid > 0 ? 'partial' : 'unpaid') : 'paid',
    is_voided: 0,
    letterhead_pdf_path: letterhead ? letterhead.pdf_template_path : null,
    letterhead_margin_top_mm: letterhead ? letterhead.content_margin_top_mm : null,
    letterhead_margin_bottom_mm: letterhead ? letterhead.content_margin_bottom_mm : null,
  };

  return {
    sale,
    items,
    groups: groupReceiptItems(items),
    showDues: false,
    outstandingBalance: null,
    duplicate: false,
    reprintAt: null,
    stampLines: ['PREVIEW ONLY', 'This bill is NOT saved yet.'],
  };
}

function getDraftReceipt(token) {
  sweep();
  const d = drafts.get(token);
  return d ? d.data : null;
}

async function previewDraft({ payload, printType }, callerId) {
  if (!payload) return { success: false, reason: 'Nothing to preview.' };
  const data = buildDraftData(payload, callerId);
  if (!data) return { success: false, reason: 'Add at least one item to preview the bill.' };

  sweep();
  const token = crypto.randomBytes(12).toString('hex');
  drafts.set(token, { data, expires: Date.now() + TTL_MS });

  try {
    if (printType === 'wholesale-a4') {
      const path = data.sale.letterhead_pdf_path;
      let bytes;
      if (path && fs.existsSync(path)) {
        bytes = await buildMergedInvoicePdf({
          templatePath: path,
          data,
          settings: settingsMap(),
          marginTopMm: data.sale.letterhead_margin_top_mm,
          marginBottomMm: data.sale.letterhead_margin_bottom_mm,
        });
      } else {
        bytes = await renderViewToPdf(`?print=1&printMode=invoice-fallback&draft=${token}`, null);
      }
      return { success: true, format: 'a4', draft: true, pdfBase64: Buffer.from(bytes).toString('base64'), invoiceNo: 'PREVIEW', stampLines: data.stampLines };
    }

    const widthMm = thermalWidthMm();
    const bytes = await renderViewToPdf(`?print=1&printMode=receipt&draft=${token}`, widthMm);
    return { success: true, format: 'thermal', draft: true, widthMm, pdfBase64: Buffer.from(bytes).toString('base64'), stampLines: data.stampLines };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not build the preview.' };
  } finally {
    drafts.delete(token);
  }
}

module.exports = { previewDraft, getDraftReceipt };
