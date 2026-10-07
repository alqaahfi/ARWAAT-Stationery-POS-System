const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { buildPurchaseReceiptData } = require('../printing/purchaseReceiptData');

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Records a completed purchase from a supplier — a header row, one line item
// per row, stock incremented (converted to base-unit terms via the line's
// selling unit conversion_factor, same conversion the POS module already uses
// for stock deduction, just adding instead of subtracting), and one
// stock_movements entry per line. All-or-nothing in a single transaction.
// Free-of-cost (foc) units arrive on the shelf but are never priced, exactly
// like a sale's FOC. Anything paid at the time becomes a supplier payment.
// Once submitted, a purchase is permanent — no edit/delete here.
function create({ supplierId, referenceNo, items, createdBy, discountAmount, paidAmount, paymentMethod }) {
  const db = getDb();

  if (!supplierId) return { success: false, reason: 'Select a supplier.' };
  if (!items || items.length === 0) return { success: false, reason: 'Add at least one line item.' };

  for (const item of items) {
    if (!item.productVariantId || !item.productUnitId) return { success: false, reason: 'Each line needs a product and unit.' };
    if (!item.quantity || Number(item.quantity) <= 0) return { success: false, reason: 'Quantity must be greater than zero.' };
    if (Number(item.focQuantity) < 0) return { success: false, reason: 'Free quantity cannot be negative.' };
    if (item.unitCost === undefined || item.unitCost === null || Number(item.unitCost) < 0) {
      return { success: false, reason: 'Enter a valid unit cost.' };
    }
  }
  if (Number(discountAmount) < 0) return { success: false, reason: 'Discount cannot be negative.' };
  if (Number(paidAmount) < 0) return { success: false, reason: 'Amount paid cannot be negative.' };
  if (Number(paidAmount) > 0 && !['cash', 'bank', 'other'].includes(paymentMethod)) {
    return { success: false, reason: 'Invalid payment method.' };
  }

  const run = db.transaction(() => {
    const lineTotals = items.map((item) => round2(Number(item.quantity) * Number(item.unitCost)));
    const subtotal = round2(lineTotals.reduce((sum, t) => sum + t, 0));
    const discount = Math.min(round2(discountAmount), subtotal);
    const totalAmount = Math.max(0, round2(subtotal - discount));
    // Never record more as paid than the bill came to.
    const paid = Math.min(round2(paidAmount), totalAmount);

    const purchaseResult = db
      .prepare(
        `INSERT INTO purchases (supplier_id, reference_no, subtotal, discount_amount, total_amount, paid_amount, created_by, purchase_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(supplierId, referenceNo || null, subtotal, discount, totalAmount, paid, createdBy || null);
    const purchaseId = purchaseResult.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO purchase_items (purchase_id, product_id, product_variant_id, quantity, foc_quantity, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const incrementStock = db.prepare(
      `UPDATE product_variants SET stock_qty = stock_qty + ?, last_purchased_at = datetime('now') WHERE id = ?`
    );
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, reference_id)
       VALUES (?, 'purchase', ?, 'purchase', ?)`
    );

    items.forEach((item, i) => {
      const unit = db.prepare('SELECT * FROM product_units WHERE id = ?').get(item.productUnitId);
      if (!unit) throw new Error(`Line ${i + 1}: selling unit not found.`);

      const foc = Math.max(0, Number(item.focQuantity) || 0);
      const baseQty = (Number(item.quantity) + foc) * unit.conversion_factor;

      insertItem.run(purchaseId, unit.product_id, item.productVariantId, Number(item.quantity), foc, Number(item.unitCost), lineTotals[i]);
      incrementStock.run(baseQty, item.productVariantId);
      insertMovement.run(item.productVariantId, baseQty, purchaseId);
    });

    if (paid > 0) {
      db.prepare(
        `INSERT INTO payments (party_type, party_id, sale_id, amount, payment_method, note, received_by)
         VALUES ('supplier', ?, NULL, ?, ?, ?, ?)`
      ).run(supplierId, paid, paymentMethod, referenceNo ? `Paid with purchase ${referenceNo}` : 'Paid with purchase', createdBy || null);
    }

    return { purchaseId, totalAmount, balanceDue: round2(totalAmount - paid) };
  });

  try {
    return { success: true, ...run() };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not complete purchase.' };
  }
}

// ---------------- Purchase History (Admin only, enforced here) ----------------

const SORTS = {
  date: 'p.purchase_date',
  supplier: 's.name COLLATE NOCASE',
  total: 'p.total_amount',
  due: '(p.total_amount - p.paid_amount)',
  reference: 'p.reference_no COLLATE NOCASE',
};

function isAdmin(db, requestingUserId) {
  const user = requestingUserId ? db.prepare('SELECT role FROM users WHERE id = ?').get(requestingUserId) : null;
  return user?.role === 'admin';
}

function list(input = {}) {
  const db = getDb();
  if (!isAdmin(db, input.requestingUserId)) return { success: false, reason: 'This action is restricted to Admin accounts.' };

  const where = [];
  const params = [];
  // Local calendar days — purchase_date is stored in UTC.
  if (input.dateFrom) {
    where.push("date(p.purchase_date, 'localtime') >= ?");
    params.push(input.dateFrom);
  }
  if (input.dateTo) {
    where.push("date(p.purchase_date, 'localtime') <= ?");
    params.push(input.dateTo);
  }
  if (input.supplierId) {
    where.push('p.supplier_id = ?');
    params.push(Number(input.supplierId));
  }
  if (input.status === 'paid') where.push('p.total_amount - p.paid_amount <= 0.005');
  else if (input.status === 'unpaid') where.push('p.total_amount - p.paid_amount > 0.005');
  const search = String(input.search || '').trim();
  if (search) {
    const like = `%${search}%`;
    where.push('(p.reference_no LIKE ? OR s.name LIKE ? OR s.phone LIKE ? OR s.mobile LIKE ?)');
    params.push(like, like, like, like);
  }

  const fromSql = `FROM purchases p JOIN suppliers s ON s.id = p.supplier_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const orderCol = SORTS[input.sortBy] || SORTS.date;
  const dir = input.sortDir === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 200);
  const offset = Math.max(Number(input.offset) || 0, 0);

  const agg = db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(p.total_amount), 0) AS sumTotal, COALESCE(SUM(p.total_amount - p.paid_amount), 0) AS sumDue ${fromSql}`
    )
    .get(...params);
  const rows = db
    .prepare(
      `SELECT p.id, p.reference_no, p.purchase_date, p.supplier_id, s.name AS supplier_name, p.subtotal, p.discount_amount,
              p.total_amount, p.paid_amount, (p.total_amount - p.paid_amount) AS balance_due,
              (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS item_count
       ${fromSql}
       ORDER BY ${orderCol} ${dir}, p.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return {
    success: true,
    rows,
    total: agg.total,
    totals: { sumTotal: agg.sumTotal, sumDue: agg.sumDue },
    hasMore: offset + rows.length < agg.total,
  };
}

function getDetail({ id, requestingUserId } = {}) {
  const db = getDb();
  if (!isAdmin(db, requestingUserId)) return { success: false, reason: 'This action is restricted to Admin accounts.' };

  const purchase = db
    .prepare(
      `SELECT p.id, p.reference_no, p.purchase_date, p.supplier_id, s.name AS supplier_name, p.subtotal, p.discount_amount,
              p.total_amount, p.paid_amount, (p.total_amount - p.paid_amount) AS balance_due, u.full_name AS created_by_name
       FROM purchases p
       JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = ?`
    )
    .get(id);
  if (!purchase) return { success: false, reason: "This purchase can't be opened." };

  const lines = db
    .prepare(
      `SELECT pi.id, pr.name AS item_name, pv.variant_name, pi.quantity, pi.foc_quantity, pi.unit_cost, pi.line_total
       FROM purchase_items pi
       JOIN products pr ON pr.id = pi.product_id
       JOIN product_variants pv ON pv.id = pi.product_variant_id
       WHERE pi.purchase_id = ?
       ORDER BY pi.id`
    )
    .all(id)
    .map((l) => ({ ...l, variant_name: l.variant_name && l.variant_name !== 'Standard' ? l.variant_name : null }));

  return { success: true, purchase, lines };
}

function registerPurchasesIpc() {
  ipcMain.handle('purchases:create', (event, payload) => create(payload || {}));
  ipcMain.handle('purchases:list', (event, payload) => list(payload || {}));
  ipcMain.handle('purchases:get-receipt-data', (event, { purchaseId } = {}) => buildPurchaseReceiptData(purchaseId));
  ipcMain.handle('purchases:get-detail', (event, payload) => getDetail(payload || {}));
}

module.exports = { registerPurchasesIpc };
