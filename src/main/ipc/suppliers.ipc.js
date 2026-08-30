const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getSupplierBalance, getBalancesForSuppliers } = require('../ledger/balanceEngine');

// list() intentionally shows both active and inactive suppliers (with an
// Active toggle in the UI), same as the Customers module — no is_active
// filter here. Callers that only want active ones (ProductForm's dropdown)
// filter client-side.
function list({ search } = {}) {
  const db = getDb();
  let sql = `
    SELECT id, name, contact_person, phone, address, notes, opening_balance, is_active, created_at
    FROM suppliers
    WHERE 1 = 1
  `;
  const params = [];

  if (search && search.trim()) {
    sql += ' AND (name LIKE ? OR phone LIKE ?)';
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }
  sql += ' ORDER BY name';

  const rows = db.prepare(sql).all(...params);
  const balances = getBalancesForSuppliers(db, rows.map((r) => r.id));

  return rows.map((r) => ({ ...r, balance_owed: balances[r.id] ?? r.opening_balance }));
}

function getById(id) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, name, contact_person, phone, address, notes, opening_balance, is_active
       FROM suppliers WHERE id = ?`
    )
    .get(id);
}

function create(payload) {
  const db = getDb();
  const { name, contactPerson, phone, address, notes, openingBalance } = payload;

  if (!name || !name.trim()) return { success: false, reason: 'Supplier name is required.' };

  const result = db
    .prepare(
      `INSERT INTO suppliers (name, contact_person, phone, address, notes, opening_balance)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name.trim(), contactPerson || null, phone || null, address || null, notes || null, Number(openingBalance) || 0);

  return { success: true, id: result.lastInsertRowid };
}

// Opening balance is deliberately not editable here — same pattern as
// Customer Form (adjust via a payment/purchase instead).
function update(payload) {
  const db = getDb();
  const { id, name, contactPerson, phone, address, notes } = payload;

  if (!id) return { success: false, reason: 'Missing supplier id.' };
  if (!name || !name.trim()) return { success: false, reason: 'Supplier name is required.' };

  db.prepare(
    `UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, address = ?, notes = ? WHERE id = ?`
  ).run(name.trim(), contactPerson || null, phone || null, address || null, notes || null, id);

  return { success: true };
}

function setActive({ id, isActive }) {
  const db = getDb();
  db.prepare('UPDATE suppliers SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, id);
  return { success: true };
}

function searchMinimal({ search }) {
  const db = getDb();
  if (!search || !search.trim()) return [];

  const like = `%${search.trim()}%`;
  const rows = db
    .prepare(
      `SELECT id, name, phone FROM suppliers
       WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?)
       ORDER BY name LIMIT 20`
    )
    .all(like, like);

  return rows.map((r) => ({ ...r, balance_owed: getSupplierBalance(db, r.id) }));
}

function getLedger(supplierId) {
  const db = getDb();
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) return { success: false, reason: 'Supplier not found.' };

  const purchases = db
    .prepare('SELECT id, reference_no, total_amount, purchase_date FROM purchases WHERE supplier_id = ? ORDER BY purchase_date')
    .all(supplierId);
  const payments = db
    .prepare(
      "SELECT id, amount, payment_method, note, created_at FROM payments WHERE party_type = 'supplier' AND party_id = ? ORDER BY created_at"
    )
    .all(supplierId);

  const transactions = [
    ...purchases.map((p) => ({
      date: p.purchase_date,
      type: 'purchase',
      reference: p.reference_no || `Purchase #${p.id}`,
      note: null,
      debit: p.total_amount,
      credit: 0,
      sortKey: `${p.purchase_date}_0_${p.id}`,
    })),
    ...payments.map((p) => ({
      date: p.created_at,
      type: 'payment',
      reference: p.payment_method,
      note: p.note,
      debit: 0,
      credit: p.amount,
      sortKey: `${p.created_at}_1_${p.id}`,
    })),
  ].sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  let running = supplier.opening_balance;
  const withBalance = transactions.map((t) => {
    running = running + t.debit - t.credit;
    return { ...t, runningBalance: running };
  });

  return {
    success: true,
    supplier: {
      id: supplier.id,
      name: supplier.name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      address: supplier.address,
      opening_balance: supplier.opening_balance,
      created_at: supplier.created_at,
    },
    transactions: withBalance,
    balance: running,
  };
}

function registerSuppliersIpc() {
  ipcMain.handle('suppliers:list', (event, payload) => list(payload || {}));
  ipcMain.handle('suppliers:get-by-id', (event, { id } = {}) => getById(id));
  ipcMain.handle('suppliers:create', (event, payload) => create(payload || {}));
  ipcMain.handle('suppliers:update', (event, payload) => update(payload || {}));
  ipcMain.handle('suppliers:set-active', (event, payload) => setActive(payload || {}));
  ipcMain.handle('suppliers:search-minimal', (event, payload) => searchMinimal(payload || {}));
  ipcMain.handle('suppliers:get-ledger', (event, { id } = {}) => getLedger(id));
}

module.exports = { registerSuppliersIpc };
