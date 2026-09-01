const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getBalancesForCustomers, getBalancesForSuppliers } = require('../ledger/balanceEngine');

// ---------------- Overview ----------------

function getOverview() {
  const db = getDb();
  const customers = db.prepare('SELECT id, name FROM customers').all();
  const suppliers = db.prepare('SELECT id, name FROM suppliers').all();
  const customerBalances = getBalancesForCustomers(db, customers.map((c) => c.id));
  const supplierBalances = getBalancesForSuppliers(db, suppliers.map((s) => s.id));

  const customerRows = customers.map((c) => ({ ...c, balance: customerBalances[c.id] || 0 }));
  const supplierRows = suppliers.map((s) => ({ ...s, balance: supplierBalances[s.id] || 0 }));

  let totalReceivable = 0;
  let totalAdvancesHeld = 0;
  for (const c of customerRows) {
    if (c.balance > 0) totalReceivable += c.balance;
    else if (c.balance < 0) totalAdvancesHeld += -c.balance;
  }

  let totalPayable = 0;
  let totalPrepaidToSuppliers = 0;
  for (const s of supplierRows) {
    if (s.balance > 0) totalPayable += s.balance;
    else if (s.balance < 0) totalPrepaidToSuppliers += -s.balance;
  }

  const topCustomers = customerRows
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);
  const topSuppliers = supplierRows
    .filter((s) => s.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  return { totalReceivable, totalPayable, totalAdvancesHeld, totalPrepaidToSuppliers, topCustomers, topSuppliers };
}

// ---------------- Payment History (combined) ----------------

function getPaymentHistory({ partyType, dateFrom, dateTo, method, search } = {}) {
  const db = getDb();
  let sql = `
    SELECT p.id, p.party_type, p.party_id, p.amount, p.payment_method, p.note, p.created_at, p.sale_id,
           u.full_name AS recorded_by_name,
           CASE WHEN p.party_type = 'customer' THEN c.name ELSE s.name END AS party_name,
           sa.invoice_no AS sale_invoice_no
    FROM payments p
    LEFT JOIN users u ON u.id = p.received_by
    LEFT JOIN customers c ON p.party_type = 'customer' AND c.id = p.party_id
    LEFT JOIN suppliers s ON p.party_type = 'supplier' AND s.id = p.party_id
    LEFT JOIN sales sa ON sa.id = p.sale_id
    WHERE 1 = 1
  `;
  const params = [];

  if (partyType === 'customer' || partyType === 'supplier') {
    sql += ' AND p.party_type = ?';
    params.push(partyType);
  }
  if (dateFrom) {
    sql += ' AND date(p.created_at) >= date(?)';
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += ' AND date(p.created_at) <= date(?)';
    params.push(dateTo);
  }
  if (method) {
    sql += ' AND p.payment_method = ?';
    params.push(method);
  }
  sql += ' ORDER BY p.created_at DESC';

  let rows = db.prepare(sql).all(...params);

  // Party name comes from a conditional join across two tables, so filtering
  // by it is simpler done here than as dynamic SQL.
  if (search && search.trim()) {
    const needle = search.trim().toLowerCase();
    rows = rows.filter((r) => (r.party_name || '').toLowerCase().includes(needle));
  }

  return rows;
}

// ---------------- Advances & Credits ----------------

function getLastActivityDate(db, partyType, partyId) {
  const otherTable = partyType === 'customer' ? 'sales' : 'purchases';
  const otherDateCol = partyType === 'customer' ? 'created_at' : 'purchase_date';
  const otherIdCol = partyType === 'customer' ? 'customer_id' : 'supplier_id';

  const otherRow = db.prepare(`SELECT MAX(${otherDateCol}) AS d FROM ${otherTable} WHERE ${otherIdCol} = ?`).get(partyId);
  const paymentRow = db
    .prepare('SELECT MAX(created_at) AS d FROM payments WHERE party_type = ? AND party_id = ?')
    .get(partyType, partyId);
  const adjustmentRow = db
    .prepare('SELECT MAX(created_at) AS d FROM ledger_adjustments WHERE party_type = ? AND party_id = ?')
    .get(partyType, partyId);

  const dates = [otherRow.d, paymentRow.d, adjustmentRow.d].filter(Boolean);
  return dates.length ? dates.sort().slice(-1)[0] : null;
}

function getAdvances() {
  const db = getDb();
  const customers = db.prepare('SELECT id, name FROM customers').all();
  const suppliers = db.prepare('SELECT id, name FROM suppliers').all();
  const customerBalances = getBalancesForCustomers(db, customers.map((c) => c.id));
  const supplierBalances = getBalancesForSuppliers(db, suppliers.map((s) => s.id));

  const rows = [];
  for (const c of customers) {
    const balance = customerBalances[c.id] || 0;
    if (balance < 0) {
      rows.push({
        partyType: 'customer',
        partyId: c.id,
        partyName: c.name,
        advanceAmount: -balance,
        lastActivity: getLastActivityDate(db, 'customer', c.id),
      });
    }
  }
  for (const s of suppliers) {
    const balance = supplierBalances[s.id] || 0;
    if (balance < 0) {
      rows.push({
        partyType: 'supplier',
        partyId: s.id,
        partyName: s.name,
        advanceAmount: -balance,
        lastActivity: getLastActivityDate(db, 'supplier', s.id),
      });
    }
  }

  rows.sort((a, b) => b.advanceAmount - a.advanceAmount);
  return rows;
}

// ---------------- Aging / Overdue (customers only) ----------------

// Practical approximation, not full accounting-grade aging: buckets each
// still-unpaid sale by the age of that sale itself (its own stored
// balance_due), rather than FIFO-reallocating every later payment against
// specific invoices. Stated as a caveat in the UI too.
function getAgingReport() {
  const db = getDb();
  const customers = db.prepare('SELECT id, name FROM customers').all();
  const now = Date.now();

  const rows = [];
  for (const c of customers) {
    const unpaidSales = db
      .prepare('SELECT id, invoice_no, balance_due, created_at FROM sales WHERE customer_id = ? AND balance_due > 0 ORDER BY created_at')
      .all(c.id);
    if (unpaidSales.length === 0) continue;

    const buckets = { b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 };
    let totalOwed = 0;
    for (const sale of unpaidSales) {
      const saleDate = new Date(sale.created_at.replace(' ', 'T') + 'Z').getTime();
      const ageDays = Math.floor((now - saleDate) / 86400000);
      totalOwed += sale.balance_due;
      if (ageDays <= 30) buckets.b0_30 += sale.balance_due;
      else if (ageDays <= 60) buckets.b31_60 += sale.balance_due;
      else if (ageDays <= 90) buckets.b61_90 += sale.balance_due;
      else buckets.b90plus += sale.balance_due;
    }

    rows.push({
      customerId: c.id,
      customerName: c.name,
      totalOwed,
      ...buckets,
      oldestUnpaidDate: unpaidSales[0].created_at,
    });
  }

  rows.sort((a, b) => b.totalOwed - a.totalOwed);
  return rows;
}

// ---------------- Manual Adjustments ----------------

function listAdjustments() {
  const db = getDb();
  return db
    .prepare(
      `SELECT la.id, la.party_type, la.party_id, la.amount, la.reason, la.created_at,
              u.full_name AS created_by_name,
              CASE WHEN la.party_type = 'customer' THEN c.name ELSE s.name END AS party_name
       FROM ledger_adjustments la
       LEFT JOIN users u ON u.id = la.created_by
       LEFT JOIN customers c ON la.party_type = 'customer' AND c.id = la.party_id
       LEFT JOIN suppliers s ON la.party_type = 'supplier' AND s.id = la.party_id
       ORDER BY la.created_at DESC`
    )
    .all();
}

// Admin-only, enforced here rather than just hidden in the UI — this writes
// straight into the balance formula, same reasoning as supplier payments.
function createAdjustment({ partyType, partyId, amount, reason, createdBy, requestingUserId }) {
  const db = getDb();

  const requester = requestingUserId ? db.prepare('SELECT role FROM users WHERE id = ?').get(requestingUserId) : null;
  if (!requester || requester.role !== 'admin') {
    return { success: false, reason: 'This action is restricted to Admin accounts.' };
  }

  if (!['customer', 'supplier'].includes(partyType)) return { success: false, reason: 'Choose a party type.' };
  if (!partyId) return { success: false, reason: 'Select a party.' };
  const amt = Number(amount);
  if (!amt || Number.isNaN(amt)) return { success: false, reason: 'Enter a non-zero amount.' };
  if (!reason || !reason.trim()) return { success: false, reason: 'A reason is required — this is a financial audit trail.' };

  db.prepare(
    'INSERT INTO ledger_adjustments (party_type, party_id, amount, reason, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(partyType, partyId, amt, reason.trim(), createdBy || null);

  return { success: true };
}

// ---------------- Payment lookup (for print/reprint) ----------------

function getPaymentById(id) {
  const db = getDb();
  const payment = db
    .prepare(
      `SELECT p.*, u.full_name AS recorded_by_name,
              CASE WHEN p.party_type = 'customer' THEN c.name ELSE s.name END AS party_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.received_by
       LEFT JOIN customers c ON p.party_type = 'customer' AND c.id = p.party_id
       LEFT JOIN suppliers s ON p.party_type = 'supplier' AND s.id = p.party_id
       WHERE p.id = ?`
    )
    .get(id);
  if (!payment) return { success: false, reason: 'Payment not found.' };
  return { success: true, payment };
}

function registerLedgersIpc() {
  ipcMain.handle('ledgers:get-overview', () => getOverview());
  ipcMain.handle('ledgers:get-payment-history', (event, payload) => getPaymentHistory(payload || {}));
  ipcMain.handle('ledgers:get-advances', () => getAdvances());
  ipcMain.handle('ledgers:get-aging-report', () => getAgingReport());
  ipcMain.handle('ledgers:list-adjustments', () => listAdjustments());
  ipcMain.handle('ledgers:create-adjustment', (event, payload) => createAdjustment(payload || {}));
  ipcMain.handle('ledgers:get-payment-by-id', (event, { id } = {}) => getPaymentById(id));
}

module.exports = { registerLedgersIpc };
