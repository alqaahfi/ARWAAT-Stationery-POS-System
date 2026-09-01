const { getDb } = require('../db/connection');
const { getCustomerBalance } = require('../ledger/balanceEngine');

// Full detail for one sale — shared by every print/preview path (thermal
// receipt, A4 invoice's print window, and the on-screen post-checkout
// preview popup) so there's one definition of "everything a receipt/invoice
// needs". Lives here (rather than in sales.ipc.js, where it used to live) so
// this file can be required by both sales.ipc.js and thermalReceipt.js
// without a circular require between them.
function getSaleDetail(saleId) {
  const db = getDb();
  const sale = db
    .prepare(
      `SELECT s.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
              u.full_name AS cashier_name,
              l.name AS letterhead_name, l.pdf_template_path AS letterhead_pdf_path,
              l.content_margin_top_mm AS letterhead_margin_top_mm, l.content_margin_bottom_mm AS letterhead_margin_bottom_mm
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       JOIN users u ON u.id = s.cashier_id
       LEFT JOIN letterheads l ON l.id = s.letterhead_id
       WHERE s.id = ?`
    )
    .get(saleId);
  if (!sale) return null;

  const items = db
    .prepare(
      `SELECT si.*, p.name AS product_name, pv.variant_name, pu.unit_name
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN product_variants pv ON pv.id = si.product_variant_id
       JOIN product_units pu ON pu.id = si.product_unit_id
       WHERE si.sale_id = ?
       ORDER BY si.id`
    )
    .all(saleId);

  return { sale, items };
}

// Single shared shape for "everything a sale receipt/invoice needs to
// render" — consumed by the thermal print formatter, the A4 print window,
// and the on-screen post-checkout preview popup, so all three can never
// drift out of sync with each other. showDues/outstandingBalance are the
// only pieces that vary per print (the cashier's "Show Outstanding Balance"
// checkbox at checkout) — everything else about a committed sale is fixed.
// outstandingBalance reflects the customer's balance AFTER this sale, since
// the sale (and any linked payment) is already committed by the time this
// runs.
function buildReceiptData(saleId, { showDues } = {}) {
  const detail = getSaleDetail(saleId);
  if (!detail) return null;

  const { sale, items } = detail;
  const applyDues = !!showDues && !!sale.customer_id;
  const outstandingBalance = applyDues ? getCustomerBalance(getDb(), sale.customer_id) : null;

  return { sale, items, showDues: applyDues, outstandingBalance };
}

module.exports = { getSaleDetail, buildReceiptData };
