const { getDb } = require('../db/connection');
const { getSupplierBalance } = require('../ledger/balanceEngine');

// Supplier's own letterhead, else the shop default, else the only letterhead
// there is — same fallback the sale screens use for customers.
function resolveLetterhead(db, assignedId) {
  const byId = (id) => db.prepare('SELECT * FROM letterheads WHERE id = ?').get(id);
  if (assignedId) {
    const own = byId(assignedId);
    if (own) return own;
  }
  const def = db.prepare('SELECT * FROM letterheads WHERE is_default = 1 ORDER BY id LIMIT 1').get();
  if (def) return def;
  const all = db.prepare('SELECT * FROM letterheads').all();
  return all.length === 1 ? all[0] : null;
}

function purchaseNumber(purchase) {
  return purchase.reference_no || `PUR-${String(purchase.id).padStart(5, '0')}`;
}

// Everything a purchase receipt needs, shaped like buildReceiptData() so the
// same letterhead-stamping code (pdfInvoiceMerge.js) can draw it:
//   sale  = header facts (party, number, date, totals, letterhead)
//   groups = one row per line (a Type's name goes on the sub-line)
function buildPurchaseReceiptData(purchaseId) {
  const db = getDb();
  const purchase = db
    .prepare(
      `SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone, s.mobile AS supplier_mobile,
              s.address AS supplier_address, s.assigned_letterhead_id, u.full_name AS created_by_name
       FROM purchases p
       JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = ?`
    )
    .get(purchaseId);
  if (!purchase) return null;

  const lines = db
    .prepare(
      `SELECT pi.*, pr.name AS product_name, pv.variant_name
       FROM purchase_items pi
       JOIN products pr ON pr.id = pi.product_id
       JOIN product_variants pv ON pv.id = pi.product_variant_id
       WHERE pi.purchase_id = ?
       ORDER BY pi.id`
    )
    .all(purchaseId);

  const letterhead = resolveLetterhead(db, purchase.assigned_letterhead_id);
  const balance = getSupplierBalance(db, purchase.supplier_id);

  const groups = lines.map((l) => ({
    product_name: l.product_name,
    unit_name: '',
    unit_price: l.unit_cost,
    quantity: l.quantity,
    quantityText: l.foc_quantity > 0 ? `${l.quantity} + ${l.foc_quantity} free` : String(l.quantity),
    line_total: l.line_total,
    variantText: l.variant_name && l.variant_name !== 'Standard' ? l.variant_name : '',
  }));

  const sale = {
    id: purchase.id,
    invoice_no: purchaseNumber(purchase),
    created_at: purchase.purchase_date,
    customer_name: purchase.supplier_name,
    customer_phone: purchase.supplier_phone || purchase.supplier_mobile || '',
    customer_address: purchase.supplier_address || '',
    cashier_name: purchase.created_by_name || '—',
    subtotal: purchase.subtotal,
    discount_amount: purchase.discount_amount,
    total_amount: purchase.total_amount,
    paid_amount: purchase.paid_amount,
    balance_due: Math.max(0, purchase.total_amount - purchase.paid_amount),
    letterhead_pdf_path: letterhead ? letterhead.pdf_template_path : null,
    letterhead_margin_top_mm: letterhead ? letterhead.content_margin_top_mm : null,
    letterhead_margin_bottom_mm: letterhead ? letterhead.content_margin_bottom_mm : null,
  };

  return {
    sale,
    items: lines,
    groups,
    showDues: true,
    outstandingBalance: balance,
    labels: {
      title: 'PURCHASE RECEIPT',
      party: 'SUPPLIER',
      details: 'PURCHASE DETAILS',
      number: 'Purchase No',
      by: 'Entered by',
      outstanding: 'Total Owed to Supplier',
    },
  };
}

module.exports = { buildPurchaseReceiptData };
