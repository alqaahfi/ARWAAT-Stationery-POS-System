const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { withCallerId } = require('../security/ipcGuard');
const { getCustomerBalance } = require('../ledger/balanceEngine');
const { wholeQty, WHOLE_QTY_MSG } = require('../validation/quantity');

// Customer returns / refunds — Admin only, enforced here (requestingUserId is
// always the signed-in caller, injected at registration below). A return is
// tied to one sale and only that sale's lines; every amount is computed here
// from the stored sale, never taken from the client. Permanent: no edit,
// delete or undo, and the original sale row is never modified.

const MAX_LIMIT = 200;
const REASONS = ['wrong_item', 'faulty', 'changed_mind', 'other'];
const EPS = 0.0001;
const DENIED = { success: false, reason: 'Only the Admin account can work with returns.' };

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function isAdmin(db, requestingUserId) {
  if (!requestingUserId) return false;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(requestingUserId);
  return !!user && user.role === 'admin';
}

function cleanVariant(name) {
  return name && name !== 'Standard' ? name : null;
}

// Every line of a sale with what's already been returned against it and the
// value one unit refunds — line_total ÷ qty sold, scaled by the sale-level
// ratio (total ÷ Σ line totals) so a return gives back what the customer
// really paid after any sale-wide discount/tax.
function loadSaleLines(db, sale) {
  const lines = db
    .prepare(
      `SELECT si.id AS sale_item_id, si.product_variant_id, si.quantity AS quantity_sold, si.line_total,
              pu.conversion_factor, p.name AS item_name, pv.variant_name, pu.unit_name,
              COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri WHERE sri.sale_item_id = si.id), 0) AS quantity_returned
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN product_variants pv ON pv.id = si.product_variant_id
       JOIN product_units pu ON pu.id = si.product_unit_id
       WHERE si.sale_id = ?
       ORDER BY si.id`
    )
    .all(sale.id);

  const sumLines = lines.reduce((s, l) => s + (Number(l.line_total) || 0), 0);
  const ratio = sumLines > 0 ? sale.total_amount / sumLines : 1;

  return lines.map((l) => ({
    ...l,
    variant_name: cleanVariant(l.variant_name),
    returnable: Math.max(0, l.quantity_sold - l.quantity_returned),
    unit_refund_value: l.quantity_sold > 0 ? (l.line_total / l.quantity_sold) * ratio : 0,
  }));
}

function earlierReturnsTotal(db, saleId) {
  return db.prepare('SELECT COALESCE(SUM(total_amount), 0) AS t FROM sale_returns WHERE sale_id = ?').get(saleId).t;
}

// Cash can only go back for the part of the return that exceeds what the
// customer still owes — a customer in debt just has the debt reduced.
function cashCap(total, balanceBefore) {
  return round2(Math.min(total, Math.max(0, total - balanceBefore)));
}

// {station}-R-{YYYYMMDD}-{seq}, per station per day — same scheme as
// sales.ipc.js's getNextInvoiceNo.
function getNextReturnNo(db, stationCode) {
  const today = db.prepare("SELECT strftime('%Y%m%d','now') AS d").get().d;
  const rows = db.prepare('SELECT return_no FROM sale_returns WHERE return_no LIKE ?').all(`${stationCode}-R-${today}-%`);
  let maxSeq = 0;
  for (const row of rows) {
    const parts = row.return_no.split('-');
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${stationCode}-R-${today}-${String(maxSeq + 1).padStart(4, '0')}`;
}

// ---------------- list / detail ----------------

function listReturns(input = {}) {
  const db = getDb();
  if (!isAdmin(db, input.requestingUserId)) return DENIED;

  const where = [];
  const params = [];
  if (input.dateFrom) {
    where.push("date(r.created_at, 'localtime') >= ?");
    params.push(input.dateFrom);
  }
  if (input.dateTo) {
    where.push("date(r.created_at, 'localtime') <= ?");
    params.push(input.dateTo);
  }
  const search = String(input.search || '').trim();
  if (search) {
    const like = `%${search}%`;
    where.push('(r.return_no LIKE ? OR s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
    params.push(like, like, like, like);
  }

  const fromSql = `
    FROM sale_returns r
    LEFT JOIN sales s ON s.id = r.sale_id
    LEFT JOIN customers c ON c.id = r.customer_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;
  const limit = Math.min(Math.max(Number(input.limit) || 50, 1), MAX_LIMIT);
  const offset = Math.max(Number(input.offset) || 0, 0);

  const total = db.prepare(`SELECT COUNT(*) AS total ${fromSql}`).get(...params).total;
  const rows = db
    .prepare(
      `SELECT r.id, r.return_no, r.created_at, r.sale_id, s.invoice_no, r.customer_id, c.name AS customer_name,
              r.reason, r.total_amount, r.cash_refund_amount,
              (SELECT COUNT(*) FROM sale_return_items sri WHERE sri.return_id = r.id) AS item_count
       ${fromSql}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return { success: true, rows, total, hasMore: offset + rows.length < total };
}

function getReturnDetail(input = {}) {
  const db = getDb();
  if (!isAdmin(db, input.requestingUserId)) return DENIED;

  const ret = db
    .prepare(
      `SELECT r.id, r.return_no, r.created_at, r.sale_id, s.invoice_no, s.created_at AS sale_created_at,
              r.customer_id, r.total_amount, r.cash_refund_amount, r.reason, r.note, r.restocked,
              u.full_name AS processed_by_name
       FROM sale_returns r
       LEFT JOIN sales s ON s.id = r.sale_id
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.id = ?`
    )
    .get(input.id);
  if (!ret) return { success: false, notFound: true, reason: "This return can't be opened." };

  let customer = null;
  if (ret.customer_id) {
    customer = db.prepare('SELECT id, name, customer_type AS type, phone FROM customers WHERE id = ?').get(ret.customer_id) || null;
  }

  const lines = db
    .prepare(
      `SELECT sri.id, p.name AS item_name, pv.variant_name, pu.unit_name, sri.quantity, sri.refund_amount
       FROM sale_return_items sri
       LEFT JOIN sale_items si ON si.id = sri.sale_item_id
       JOIN product_variants pv ON pv.id = COALESCE(si.product_variant_id, sri.product_variant_id)
       JOIN products p ON p.id = pv.product_id
       JOIN product_units pu ON pu.id = COALESCE(si.product_unit_id, sri.product_unit_id)
       WHERE sri.return_id = ?
       ORDER BY sri.id`
    )
    .all(ret.id)
    .map((l) => ({ ...l, variant_name: cleanVariant(l.variant_name) }));

  return { success: true, return: { ...ret, restocked: !!ret.restocked }, customer, lines };
}

// ---------------- returnable ----------------

function getReturnable(input = {}) {
  const db = getDb();
  if (!isAdmin(db, input.requestingUserId)) return DENIED;

  const sale = db
    .prepare('SELECT id, invoice_no, created_at, sale_type, customer_id, total_amount, is_voided FROM sales WHERE id = ?')
    .get(input.saleId);
  if (!sale) return { success: false, notFound: true, reason: "This sale can't be found." };
  if (sale.is_voided) return { success: false, voided: true, reason: 'This bill was voided, so nothing on it can be returned.' };

  let customer = null;
  if (sale.customer_id) {
    const row = db.prepare('SELECT id, name, customer_type AS type, phone FROM customers WHERE id = ?').get(sale.customer_id);
    if (row) customer = { ...row, balance: getCustomerBalance(db, row.id) };
  }

  const lines = loadSaleLines(db, sale).map((l) => ({
    sale_item_id: l.sale_item_id,
    item_name: l.item_name,
    variant_name: l.variant_name,
    unit_name: l.unit_name,
    quantity_sold: l.quantity_sold,
    quantity_returned: l.quantity_returned,
    returnable: l.returnable,
    unit_refund_value: l.unit_refund_value,
  }));

  const { customer_id, ...saleOut } = sale;
  return {
    success: true,
    sale: saleOut,
    customer,
    lines,
    remainingValue: round2(sale.total_amount - earlierReturnsTotal(db, sale.id)),
  };
}

// ---------------- create ----------------

function createReturn(input = {}) {
  const db = getDb();
  if (!isAdmin(db, input.requestingUserId)) return DENIED;

  const sale = db.prepare('SELECT id, invoice_no, customer_id, total_amount, is_voided FROM sales WHERE id = ?').get(input.saleId);
  if (!sale) return { success: false, reason: "This sale can't be found." };
  if (sale.is_voided) return { success: false, reason: 'This bill was voided, so nothing on it can be returned.' };

  const reason = String(input.reason || '');
  if (!REASONS.includes(reason)) return { success: false, reason: 'Choose why the items are coming back.' };

  // Merge repeated lines for the same sale item, drop zero quantities.
  const wanted = new Map();
  for (const line of Array.isArray(input.lines) ? input.lines : []) {
    const qty = Number(line && line.quantity);
    if (!Number.isFinite(qty) || qty < 0) return { success: false, reason: 'Return quantities must be positive numbers.' };
    if (wholeQty(qty, { allowZero: true }) === null) return { success: false, reason: WHOLE_QTY_MSG };
    if (qty === 0) continue;
    const key = Number(line.saleItemId);
    wanted.set(key, (wanted.get(key) || 0) + qty);
  }
  if (!wanted.size) return { success: false, reason: 'Choose at least one item to return.' };

  const restock = input.restock !== false;
  const note = String(input.note || '').trim() || null;

  const activation = db.prepare('SELECT station_code FROM station_config WHERE id = 1').get();
  const stationCode = (activation && activation.station_code) || 'MAIN';

  const run = db.transaction(() => {
    const lines = loadSaleLines(db, sale);
    const byId = new Map(lines.map((l) => [l.sale_item_id, l]));

    const picked = [];
    for (const [saleItemId, qty] of wanted) {
      const line = byId.get(saleItemId);
      if (!line) throw new Error('One of the items is not on this sale.');
      if (qty > line.returnable + EPS) {
        throw new Error(
          line.returnable <= EPS
            ? `"${line.item_name}" has already been returned in full.`
            : `Only ${Number(line.returnable.toFixed(3))} of "${line.item_name}" can still be returned.`
        );
      }
      picked.push({ line, qty, refund: round2(qty * line.unit_refund_value) });
    }

    // Nothing left returnable after this one → the return totals must add up
    // to exactly the sale total; the rounding difference lands on the last line.
    const nothingLeft = lines.every((l) => l.returnable - (wanted.get(l.sale_item_id) || 0) <= EPS);
    let total = round2(picked.reduce((s, p) => s + p.refund, 0));
    if (nothingLeft) {
      const exact = round2(sale.total_amount - earlierReturnsTotal(db, sale.id));
      picked[picked.length - 1].refund = round2(picked[picked.length - 1].refund + (exact - total));
      total = exact;
    }

    let cash;
    let balanceBefore = null;
    if (sale.customer_id) {
      balanceBefore = getCustomerBalance(db, sale.customer_id);
      const cap = cashCap(total, balanceBefore);
      cash = round2(Number(input.cashRefund) || 0);
      if (cash < 0) throw new Error('Cash back cannot be negative.');
      if (cash > cap + 0.005) {
        throw new Error(
          cap <= 0
            ? 'This customer still owes you money, so no cash can be given back — the return reduces what they owe.'
            : `Cash back can be at most ${cap.toFixed(2)} for this return.`
        );
      }
    } else {
      cash = total; // walk-in: no account, so everything goes back in cash
    }

    const returnNo = getNextReturnNo(db, stationCode);
    const returnId = db
      .prepare(
        `INSERT INTO sale_returns (return_no, sale_id, customer_id, total_amount, cash_refund_amount, reason, note, restocked, created_by, origin_pc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(returnNo, sale.id, sale.customer_id || null, total, cash, reason, note, restock ? 1 : 0, input.requestingUserId, stationCode)
      .lastInsertRowid;

    const insertItem = db.prepare('INSERT INTO sale_return_items (return_id, sale_item_id, quantity, refund_amount) VALUES (?, ?, ?, ?)');
    const addStock = db.prepare('UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?');
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, reference_id, note, created_by)
       VALUES (?, 'return_in', ?, 'return', ?, ?, ?)`
    );

    for (const p of picked) {
      insertItem.run(returnId, p.line.sale_item_id, p.qty, p.refund);
      if (restock) {
        const baseQty = p.qty * p.line.conversion_factor;
        addStock.run(baseQty, p.line.product_variant_id);
        insertMovement.run(p.line.product_variant_id, baseQty, returnId, returnNo, input.requestingUserId);
      }
    }

    // sync_outbox rows come from trg_sale_returns_ai / trg_sale_return_items_ai
    // (026_sale_returns.sql) and trg_stock_movements_ai — nothing to queue here.

    return {
      id: returnId,
      return_no: returnNo,
      total_amount: total,
      cash_refund_amount: cash,
      credited_amount: round2(total - cash),
      new_balance: sale.customer_id ? getCustomerBalance(db, sale.customer_id) : null,
    };
  });

  try {
    return { success: true, ...run() };
  } catch (err) {
    return { success: false, reason: err.message || 'The return could not be recorded.' };
  }
}

// ---------------- Rule 17: find the bill without the bill ----------------
// Searches non-voided bills by bill number, customer name/phone, item name /
// search spelling / barcode, and date (YYYY-MM-DD or DD-MM-YYYY), plus an
// optional date range. Newest first, same row shape as Sales History.
function searchSalesForReturn(input = {}) {
  const db = getDb();
  if (!isAdmin(db, input.requestingUserId)) return DENIED;
  const text = String(input.search || '').trim();
  const where = ['s.is_voided = 0'];
  const params = [];
  if (input.dateFrom) {
    where.push("date(s.created_at, 'localtime') >= ?");
    params.push(input.dateFrom);
  }
  if (input.dateTo) {
    where.push("date(s.created_at, 'localtime') <= ?");
    params.push(input.dateTo);
  }
  if (text) {
    const like = `%${text}%`;
    const conds = [
      's.invoice_no LIKE ?',
      'c.name LIKE ?',
      'c.phone LIKE ?',
      'c.mobile LIKE ?',
      `EXISTS (SELECT 1 FROM sale_items si JOIN products p ON p.id = si.product_id JOIN product_variants pv ON pv.id = si.product_variant_id
               WHERE si.sale_id = s.id AND (p.name LIKE ? OR p.search_alias LIKE ? OR pv.barcode = ? OR pv.variant_name LIKE ?))`,
    ];
    params.push(like, like, like, like, like, like, text, like);
    let day = null;
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (m) day = `${m[1]}-${m[2]}-${m[3]}`;
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
    if (m) day = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (day) {
      conds.push("date(s.created_at, 'localtime') = ?");
      params.push(day);
    }
    where.push(`(${conds.join(' OR ')})`);
  }
  const limit = Math.min(Math.max(Number(input.limit) || 30, 1), MAX_LIMIT);
  const rows = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.created_at, s.sale_type, s.customer_id, c.name AS customer_name, s.total_amount,
              s.paid_amount, s.balance_due, s.payment_status, u.full_name AS cashier_name,
              (SELECT COALESCE(SUM(r.total_amount), 0) FROM sale_returns r WHERE r.sale_id = s.id) AS returned_amount,
              CASE
                WHEN NOT EXISTS (SELECT 1 FROM sale_returns r WHERE r.sale_id = s.id) THEN 'none'
                WHEN NOT EXISTS (
                  SELECT 1 FROM sale_items si
                  WHERE si.sale_id = s.id
                    AND si.quantity - COALESCE((SELECT SUM(sri.quantity) FROM sale_return_items sri WHERE sri.sale_item_id = si.id), 0) > 0.0001
                ) THEN 'full'
                ELSE 'partial'
              END AS return_status
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       JOIN users u ON u.id = s.cashier_id
       WHERE ${where.join(' AND ')}
       ORDER BY s.created_at DESC, s.id DESC
       LIMIT ?`
    )
    .all(...params, limit);
  return { success: true, rows };
}

// ---------------- Rule 17: return without the bill (Admin only) ----------------
// Refund per unit = the lowest price this pack size really sold for in the last
// 30 days (unit price after the bill's own discount share, non-voided bills),
// else today's retail price. Always cash, stock always goes back, no customer,
// no sale link — so it never touches any bill's "returnable" quantities.
function noBillUnitPrice(db, productUnitId) {
  const unit = db.prepare('SELECT id, product_id, retail_price FROM product_units WHERE id = ?').get(productUnitId);
  if (!unit) return null;
  const row = db
    .prepare(
      `SELECT MIN(si.unit_price * CASE WHEN s.subtotal > 0 THEN s.total_amount / s.subtotal ELSE 1 END) AS low
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE si.product_unit_id = ? AND s.is_voided = 0 AND si.quantity > 0
         AND s.created_at >= datetime('now', '-30 days')`
    )
    .get(productUnitId);
  const sold = row && row.low !== null && row.low !== undefined;
  return { price: round2(sold ? row.low : unit.retail_price), source: sold ? 'lowest_30_days' : 'retail' };
}

function loadNoBillLine(db, input) {
  const variant = db.prepare('SELECT pv.id, pv.product_id, pv.variant_name, p.name FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ?').get(input.productVariantId);
  if (!variant) return { error: 'Choose the item that is coming back.' };
  const unit = db.prepare('SELECT id, product_id, unit_name, conversion_factor FROM product_units WHERE id = ? AND product_id = ?').get(input.productUnitId, variant.product_id);
  if (!unit) return { error: 'Choose a pack size of that item.' };
  return { variant, unit };
}

function getNoBillPrice(input = {}) {
  const db = getDb();
  if (!isAdmin(db, input.requestingUserId)) return DENIED;
  const line = loadNoBillLine(db, input);
  if (line.error) return { success: false, reason: line.error };
  return { success: true, ...noBillUnitPrice(db, line.unit.id) };
}

function createNoBillReturn(input = {}) {
  const db = getDb();
  if (!isAdmin(db, input.requestingUserId)) return DENIED;
  const reason = String(input.reason || '');
  if (!REASONS.includes(reason)) return { success: false, reason: 'Choose why the items are coming back.' };
  const qty = wholeQty(input.quantity);
  if (qty === null) return { success: false, reason: WHOLE_QTY_MSG };
  const line = loadNoBillLine(db, input);
  if (line.error) return { success: false, reason: line.error };
  const note = String(input.note || '').trim() || null;
  const activation = db.prepare('SELECT station_code FROM station_config WHERE id = 1').get();
  const stationCode = (activation && activation.station_code) || 'MAIN';

  const run = db.transaction(() => {
    const { price, source } = noBillUnitPrice(db, line.unit.id);
    const total = round2(price * qty);
    const returnNo = getNextReturnNo(db, stationCode);
    const returnId = db
      .prepare(
        `INSERT INTO sale_returns (return_no, sale_id, customer_id, total_amount, cash_refund_amount, reason, note, restocked, created_by, origin_pc)
         VALUES (?, NULL, NULL, ?, ?, ?, ?, 1, ?, ?)`
      )
      .run(returnNo, total, total, reason, note ? `No bill. ${note}` : 'No bill', input.requestingUserId, stationCode).lastInsertRowid;
    db.prepare(
      'INSERT INTO sale_return_items (return_id, sale_item_id, product_variant_id, product_unit_id, quantity, refund_amount) VALUES (?, NULL, ?, ?, ?, ?)'
    ).run(returnId, line.variant.id, line.unit.id, qty, total);
    const baseQty = qty * line.unit.conversion_factor;
    db.prepare('UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?').run(baseQty, line.variant.id);
    db.prepare(
      `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, reference_id, note, created_by)
       VALUES (?, 'return_in', ?, 'return', ?, ?, ?)`
    ).run(line.variant.id, baseQty, returnId, `${returnNo} (no bill)`, input.requestingUserId);
    return { id: returnId, return_no: returnNo, total_amount: total, cash_refund_amount: total, credited_amount: 0, unit_price: price, price_source: source, new_balance: null };
  });
  try {
    return { success: true, ...run() };
  } catch (err) {
    return { success: false, reason: err.message || 'The return could not be recorded.' };
  }
}

function registerReturnsIpc() {
  ipcMain.handle('returns:list', (event, input) => listReturns(withCallerId(event, input, 'requestingUserId')));
  ipcMain.handle('returns:get-detail', (event, input) => getReturnDetail(withCallerId(event, input, 'requestingUserId')));
  ipcMain.handle('returns:get-returnable', (event, input) => getReturnable(withCallerId(event, input, 'requestingUserId')));
  ipcMain.handle('returns:create', (event, input) => createReturn(withCallerId(event, input, 'requestingUserId')));
  // Rule 17 (Admin only through the returns: prefix).
  ipcMain.handle('returns:search-sales', (event, input) => searchSalesForReturn(withCallerId(event, input, 'requestingUserId')));
  ipcMain.handle('returns:no-bill-price', (event, input) => getNoBillPrice(withCallerId(event, input, 'requestingUserId')));
  ipcMain.handle('returns:create-no-bill', (event, input) => createNoBillReturn(withCallerId(event, input, 'requestingUserId')));
}

module.exports = { registerReturnsIpc };
