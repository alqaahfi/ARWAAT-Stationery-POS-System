const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getCustomerBalance } = require('../ledger/balanceEngine');

// Read-only Sales History list + one-sale detail. Caller identification
// mirrors reports:get-sales-report (the renderer passes requestingUserId);
// a cashier additionally needs view_sales_history and is always locked to
// their own sales, whatever cashierId a crafted call sends.

const MAX_LIMIT = 200;

// Returns (Phase 10B), read-only: how much has come back on a sale, and
// whether anything is still returnable ('full' = nothing left to return).
const RETURNED_AMOUNT_SQL = '(SELECT COALESCE(SUM(r.total_amount), 0) FROM sale_returns r WHERE r.sale_id = s.id)';
const RETURN_STATUS_SQL = `
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM sale_returns r WHERE r.sale_id = s.id) THEN 'none'
    WHEN NOT EXISTS (
      SELECT 1 FROM sale_items si
      WHERE si.sale_id = s.id
        AND si.quantity - COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri WHERE sri.sale_item_id = si.id), 0) > 0.0001
    ) THEN 'full'
    ELSE 'partial'
  END`;

function resolveAccess(db, requestingUserId) {
  if (!requestingUserId) return { ok: false };
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(requestingUserId);
  if (!user) return { ok: false };
  if (user.role === 'admin') return { ok: true, lockedCashierId: null };
  const perm = db
    .prepare("SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_key = 'view_sales_history'")
    .get(user.id);
  if (!perm) return { ok: false };
  return { ok: true, lockedCashierId: user.id };
}

function listSales(input = {}) {
  const db = getDb();
  const access = resolveAccess(db, input.requestingUserId);
  if (!access.ok) return { success: false, reason: "You don't have access to Sales History." };

  const where = [];
  const params = [];

  // Local calendar days — created_at is stored in UTC.
  if (input.dateFrom) {
    where.push("date(s.created_at, 'localtime') >= ?");
    params.push(input.dateFrom);
  }
  if (input.dateTo) {
    where.push("date(s.created_at, 'localtime') <= ?");
    params.push(input.dateTo);
  }
  if (['paid', 'partial', 'unpaid'].includes(input.status)) {
    where.push('s.payment_status = ?');
    params.push(input.status);
  }
  if (['retail', 'wholesale'].includes(input.saleType)) {
    where.push('s.sale_type = ?');
    params.push(input.saleType);
  }
  const cashierId = access.lockedCashierId || (input.cashierId ? Number(input.cashierId) : null);
  if (cashierId) {
    where.push('s.cashier_id = ?');
    params.push(cashierId);
  }
  const search = String(input.search || '').trim();
  if (search) {
    const like = `%${search}%`;
    where.push('(s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
    params.push(like, like, like);
  }

  const fromSql = `
    FROM sales s
    JOIN users u ON u.id = s.cashier_id
    LEFT JOIN customers c ON c.id = s.customer_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;

  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), MAX_LIMIT);
  const offset = Math.max(Number(input.offset) || 0, 0);

  const agg = db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(s.total_amount), 0) AS sumTotal, COALESCE(SUM(s.balance_due), 0) AS sumBalanceDue ${fromSql}`
    )
    .get(...params);

  const rows = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.created_at, s.sale_type, s.customer_id, c.name AS customer_name,
              s.cashier_id, u.full_name AS cashier_name, s.total_amount, s.paid_amount, s.balance_due, s.payment_status,
              ${RETURNED_AMOUNT_SQL} AS returned_amount,
              ${RETURN_STATUS_SQL} AS return_status
       ${fromSql}
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return {
    success: true,
    rows,
    total: agg.total,
    totals: { sumTotal: agg.sumTotal, sumBalanceDue: agg.sumBalanceDue },
    hasMore: offset + rows.length < agg.total,
  };
}

function getSaleDetail(input = {}) {
  const db = getDb();
  const access = resolveAccess(db, input.requestingUserId);
  const notFound = { success: false, notFound: true, reason: "This sale can't be opened." };
  if (!access.ok) return notFound;

  const sale = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.created_at, s.sale_type, s.customer_id, s.cashier_id, u.full_name AS cashier_name,
              s.origin_pc, s.subtotal, s.discount_amount, s.tax_amount, s.total_amount, s.paid_amount, s.balance_due,
              s.payment_status, ${RETURNED_AMOUNT_SQL} AS returned_amount, ${RETURN_STATUS_SQL} AS return_status
       FROM sales s
       JOIN users u ON u.id = s.cashier_id
       WHERE s.id = ?`
    )
    .get(input.id);
  if (!sale) return notFound;
  if (access.lockedCashierId && sale.cashier_id !== access.lockedCashierId) return notFound;

  let customer = null;
  if (sale.customer_id) {
    const row = db.prepare('SELECT id, name, customer_type AS type, phone FROM customers WHERE id = ?').get(sale.customer_id);
    if (row) customer = { ...row, balance: getCustomerBalance(db, row.id) };
  }

  const lines = db
    .prepare(
      `SELECT si.id, p.name AS item_name, pv.variant_name, pu.unit_name,
              si.quantity, si.unit_price, si.discount_amount, si.line_total,
              COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri WHERE sri.sale_item_id = si.id), 0) AS quantity_returned
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN product_variants pv ON pv.id = si.product_variant_id
       JOIN product_units pu ON pu.id = si.product_unit_id
       WHERE si.sale_id = ?
       ORDER BY si.id`
    )
    .all(sale.id)
    .map((l) => ({ ...l, variant_name: l.variant_name && l.variant_name !== 'Standard' ? l.variant_name : null }));

  const payments = db
    .prepare('SELECT id, amount, payment_method, created_at, note FROM payments WHERE sale_id = ? ORDER BY created_at, id')
    .all(sale.id);

  const returns = db
    .prepare(
      `SELECT id, return_no, created_at, total_amount, cash_refund_amount, reason
       FROM sale_returns WHERE sale_id = ? ORDER BY created_at, id`
    )
    .all(sale.id);

  return { success: true, sale, customer, lines, payments, returns };
}

function registerSalesHistoryIpc() {
  ipcMain.handle('sales:list', (event, input) => listSales(input || {}));
  ipcMain.handle('sales:get-detail', (event, input) => getSaleDetail(input || {}));
}

module.exports = { registerSalesHistoryIpc };
