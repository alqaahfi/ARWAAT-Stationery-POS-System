const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getNextId } = require('../db/nextId');
const { getCustomerBalance, getBalancesForCustomers } = require('../ledger/balanceEngine');
const { getAdjustmentRows } = require('../ledger/adjustmentRows');
const { getReturnRows } = require('../ledger/returnRows');

// Fixed 5-tier structure — not admin-configurable. Validated here rather than
// with a DB-level CHECK, consistent with how SKU/username uniqueness is
// checked elsewhere in this project.
const TIERS = ['C1', 'C2', 'C3', 'C4', 'C5'];

function isValidTier(tier) {
  return tier === null || tier === undefined || TIERS.includes(tier);
}

// ---------------- Customers ----------------

function list({ search, tier, customerType } = {}) {
  const db = getDb();
  let sql = `
    SELECT c.id, c.name, c.customer_type, c.tier,
           c.assigned_letterhead_id, c.phone, c.mobile, c.address, c.opening_balance, c.is_active
    FROM customers c
    WHERE 1 = 1
  `;
  const params = [];

  if (search && search.trim()) {
    sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.mobile LIKE ?)';
    const like = `%${search.trim()}%`;
    params.push(like, like, like);
  }
  if (tier === 'NONE') {
    sql += ' AND c.tier IS NULL';
  } else if (tier) {
    sql += ' AND c.tier = ?';
    params.push(tier);
  }
  if (customerType) {
    sql += ' AND c.customer_type = ?';
    params.push(customerType);
  }
  sql += ' ORDER BY c.name';

  const rows = db.prepare(sql).all(...params);
  const balances = getBalancesForCustomers(db, rows.map((r) => r.id));

  return rows.map((r) => ({ ...r, balance_owed: balances[r.id] ?? r.opening_balance }));
}

function getById(id) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, name, customer_type, tier, assigned_letterhead_id, phone, mobile, email, address,
              opening_balance, credit_limit, joining_date, notes, is_active
       FROM customers WHERE id = ?`
    )
    .get(id);
}

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toCreditLimit(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function create(payload) {
  const db = getDb();
  const { name, customerType, tier, assignedLetterheadId, phone, mobile, email, address, openingBalance, creditLimit, joiningDate, notes } =
    payload;

  if (!name || !name.trim()) return { success: false, reason: 'Customer name is required.' };
  if (!['retail', 'wholesale'].includes(customerType)) return { success: false, reason: 'Customer type must be retail or wholesale.' };
  if (!isValidTier(tier)) return { success: false, reason: 'Invalid tier.' };

  const result = db
    .prepare(
      `INSERT INTO customers (name, customer_type, tier, assigned_letterhead_id, phone, mobile, email, address, opening_balance, credit_limit, joining_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name.trim(),
      customerType,
      tier || null,
      assignedLetterheadId || null,
      phone || null,
      mobile || null,
      email || null,
      address || null,
      Number(openingBalance) || 0,
      toCreditLimit(creditLimit),
      joiningDate || todayLocal(),
      notes || null
    );

  return { success: true, id: result.lastInsertRowid };
}

// Opening balance is deliberately not editable here — the form shows it
// read-only and points the admin at Record Payment / the ledger instead.
function update(payload) {
  const db = getDb();
  const { id, name, customerType, tier, assignedLetterheadId, phone, mobile, email, address, creditLimit, joiningDate, notes } = payload;

  if (!id) return { success: false, reason: 'Missing customer id.' };
  if (!name || !name.trim()) return { success: false, reason: 'Customer name is required.' };
  if (!['retail', 'wholesale'].includes(customerType)) return { success: false, reason: 'Customer type must be retail or wholesale.' };
  if (!isValidTier(tier)) return { success: false, reason: 'Invalid tier.' };

  db.prepare(
    `UPDATE customers
     SET name = ?, customer_type = ?, tier = ?, assigned_letterhead_id = ?, phone = ?, mobile = ?, email = ?, address = ?,
         credit_limit = ?, joining_date = ?, notes = ?
     WHERE id = ?`
  ).run(
    name.trim(),
    customerType,
    tier || null,
    assignedLetterheadId || null,
    phone || null,
    mobile || null,
    email || null,
    address || null,
    toCreditLimit(creditLimit),
    joiningDate || null,
    notes || null,
    id
  );

  return { success: true };
}

function setActive({ id, isActive }) {
  const db = getDb();
  db.prepare('UPDATE customers SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
  return { success: true };
}

// For the standalone Record Payment screen (reachable by cashiers) — name,
// phone, id and computed balance only. No address, category, or anything else
// that screen has no business showing.
function searchMinimal({ search }) {
  const db = getDb();
  if (!search || !search.trim()) return [];

  const like = `%${search.trim()}%`;
  const rows = db
    .prepare(
      `SELECT id, name, customer_type, phone, mobile FROM customers
       WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ? OR mobile LIKE ?)
       ORDER BY name LIMIT 20`
    )
    .all(like, like, like);

  return rows.map((r) => ({ ...r, balance_owed: getCustomerBalance(db, r.id) }));
}

function getLedger(customerId) {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) return { success: false, reason: 'Customer not found.' };

  const sales = db
    .prepare('SELECT id, invoice_no, total_amount, created_at FROM sales WHERE customer_id = ? ORDER BY created_at')
    .all(customerId);
  const payments = db
    .prepare(
      "SELECT id, amount, payment_method, note, created_at FROM payments WHERE party_type = 'customer' AND party_id = ? ORDER BY created_at"
    )
    .all(customerId);
  const adjustments = getAdjustmentRows(db, 'customer', customerId);
  const returns = getReturnRows(db, customerId);

  // Merge and sort chronologically. Ties (same timestamp) put sales first —
  // arbitrary but stable, and irrelevant in practice since timestamps are
  // second-resolution and true simultaneity essentially never happens.
  const transactions = [
    ...sales.map((s) => ({
      date: s.created_at,
      type: 'sale',
      reference: s.invoice_no,
      note: null,
      debit: s.total_amount,
      credit: 0,
      sortKey: `${s.created_at}_0_${s.id}`,
    })),
    ...payments.map((p) => ({
      date: p.created_at,
      type: 'payment',
      paymentId: p.id,
      label: 'Received',
      reference: p.payment_method,
      note: p.note,
      debit: 0,
      credit: p.amount,
      sortKey: `${p.created_at}_1_${p.id}`,
    })),
    ...adjustments,
    ...returns,
  ].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  let running = customer.opening_balance;
  const withBalance = transactions.map((t) => {
    running = running + t.debit - t.credit;
    return { ...t, runningBalance: running };
  });

  return {
    success: true,
    customer: {
      id: customer.id,
      name: customer.name,
      customer_type: customer.customer_type,
      tier: customer.tier,
      phone: customer.phone,
      mobile: customer.mobile,
      email: customer.email,
      address: customer.address,
      opening_balance: customer.opening_balance,
      credit_limit: customer.credit_limit,
      joining_date: customer.joining_date,
      notes: customer.notes,
      created_at: customer.created_at,
    },
    transactions: withBalance,
    // Headline balance comes from the balance engine so this page and every
    // list agree; the running total above (corrections and returns included) ends on it.
    balance: getCustomerBalance(db, customerId),
  };
}

function registerCustomersIpc() {
  ipcMain.handle('customers:list', (event, payload) => list(payload || {}));
  ipcMain.handle('customers:get-by-id', (event, { id } = {}) => getById(id));
  ipcMain.handle('customers:create', (event, payload) => create(payload || {}));
  ipcMain.handle('customers:update', (event, payload) => update(payload || {}));
  ipcMain.handle('customers:set-active', (event, payload) => setActive(payload || {}));
  ipcMain.handle('customers:search-minimal', (event, payload) => searchMinimal(payload || {}));
  ipcMain.handle('customers:get-next-id', () => ({ success: true, id: getNextId(getDb(), 'customers') }));
  ipcMain.handle('customers:get-ledger', (event, { id } = {}) => getLedger(id));

}

module.exports = { registerCustomersIpc };
