const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getNextId } = require('../db/nextId');
const { getCustomerBalance, getBalancesForCustomers } = require('../ledger/balanceEngine');
const { getAdjustmentRows } = require('../ledger/adjustmentRows');
const { getReturnRows } = require('../ledger/returnRows');
const { creditLimitCheck } = require('../ledger/creditLimit');

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

// Rule 7: the same phone/mobile on two customers is a WARNING (the form asks,
// saving is still allowed). Numbers are compared by their digits, so
// "0300-1234567", "0300 1234567" and "+92 300 1234567" are the same number.
function phoneKey(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length === 12) digits = `0${digits.slice(2)}`;
  return digits.length >= 7 ? digits : '';
}

function findDuplicatePhones({ phone, mobile, excludeId } = {}) {
  const db = getDb();
  const wanted = new Set([phoneKey(phone), phoneKey(mobile)].filter(Boolean));
  if (!wanted.size) return { success: true, matches: [] };
  const rows = db
    .prepare('SELECT id, name, phone, mobile, is_active FROM customers WHERE id != ? AND (phone IS NOT NULL OR mobile IS NOT NULL)')
    .all(Number(excludeId) || 0);
  const matches = rows
    .filter((r) => wanted.has(phoneKey(r.phone)) || wanted.has(phoneKey(r.mobile)))
    .map((r) => ({ id: r.id, name: r.name, phone: r.phone, mobile: r.mobile, isActive: !!r.is_active }));
  return { success: true, matches };
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
    .prepare('SELECT id, invoice_no, total_amount, created_at FROM sales WHERE customer_id = ? AND is_voided = 0 ORDER BY created_at')
    .all(customerId);
  const payments = db
    .prepare(
      "SELECT id, amount, payment_method, note, created_at FROM payments WHERE party_type = 'customer' AND party_id = ? AND is_voided = 0 ORDER BY created_at"
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


function getSpecialPrices(customerId) {
  const db = getDb();
  if (!customerId) return [];
  return db
    .prepare(
      `SELECT sp.*, p.name AS product_name, p.sku AS product_sku, pu.unit_name
       FROM customer_special_prices sp
       JOIN products p ON p.id = sp.product_id
       LEFT JOIN product_units pu ON pu.id = sp.product_unit_id
       WHERE sp.customer_id = ?
       ORDER BY sp.id DESC`
    )
    .all(customerId);
}

function saveSpecialPrice({ id, customerId, productId, productUnitId, pricingType, price, percentage } = {}) {
  const db = getDb();
  if (!customerId) return { success: false, reason: 'Customer is required.' };
  if (!productId) return { success: false, reason: 'Product is required.' };
  if (!['fixed', 'discount_percent', 'margin_percent'].includes(pricingType)) {
    return { success: false, reason: 'Invalid pricing type.' };
  }

  const numPrice = price !== undefined && price !== null && price !== '' ? Number(price) : null;
  const numPercent = percentage !== undefined && percentage !== null && percentage !== '' ? Number(percentage) : null;

  if (pricingType === 'fixed' && (numPrice === null || isNaN(numPrice) || numPrice < 0)) {
    return { success: false, reason: 'Please enter a valid price.' };
  }
  if ((pricingType === 'discount_percent' || pricingType === 'margin_percent') && (numPercent === null || isNaN(numPercent) || numPercent < 0)) {
    return { success: false, reason: 'Please enter a valid percentage.' };
  }

  const targetUnitId = productUnitId ? Number(productUnitId) : null;

  try {
    if (id) {
      db.prepare(
        `UPDATE customer_special_prices
         SET product_id = ?, product_unit_id = ?, pricing_type = ?, price = ?, percentage = ?, updated_at = datetime('now')
         WHERE id = ? AND customer_id = ?`
      ).run(productId, targetUnitId, pricingType, numPrice, numPercent, id, customerId);
      return { success: true, id };
    } else {
      const res = db.prepare(
        `INSERT INTO customer_special_prices (customer_id, product_id, product_unit_id, pricing_type, price, percentage)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(customerId, productId, targetUnitId, pricingType, numPrice, numPercent);
      return { success: true, id: res.lastInsertRowid };
    }
  } catch (err) {
    return { success: false, reason: err.message || 'Could not save special price.' };
  }
}

function deleteSpecialPrice({ id } = {}) {
  const db = getDb();
  if (!id) return { success: false, reason: 'Missing id.' };
  db.prepare('DELETE FROM customer_special_prices WHERE id = ?').run(id);
  return { success: true };
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
  // Rule 2: credit limit is a warning only (asked by the sale screens before saving; never blocks).
  ipcMain.handle('customers:check-duplicate-phone', (event, payload) => findDuplicatePhones(payload || {}));
  ipcMain.handle('customers:credit-check', (event, payload) => creditLimitCheck(getDb(), payload || {}));
  ipcMain.handle('customers:get-special-prices', (event, { customerId } = {}) => getSpecialPrices(customerId));
  ipcMain.handle('customers:save-special-price', (event, payload) => saveSpecialPrice(payload || {}));
  ipcMain.handle('customers:delete-special-price', (event, payload) => deleteSpecialPrice(payload || {}));

}

module.exports = { registerCustomersIpc };
