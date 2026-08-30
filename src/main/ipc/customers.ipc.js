const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getCustomerBalance, getBalancesForCustomers } = require('../ledger/balanceEngine');

// ---------------- Customers ----------------

function list({ search, categoryId, customerType } = {}) {
  const db = getDb();
  let sql = `
    SELECT c.id, c.name, c.customer_type, c.category_id, cc.name AS category_name,
           c.assigned_letterhead_id, c.phone, c.address, c.opening_balance, c.is_active
    FROM customers c
    LEFT JOIN customer_categories cc ON cc.id = c.category_id
    WHERE 1 = 1
  `;
  const params = [];

  if (search && search.trim()) {
    sql += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }
  if (categoryId) {
    sql += ' AND c.category_id = ?';
    params.push(categoryId);
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
      `SELECT id, name, customer_type, category_id, assigned_letterhead_id, phone, address, opening_balance, is_active
       FROM customers WHERE id = ?`
    )
    .get(id);
}

function create(payload) {
  const db = getDb();
  const { name, customerType, categoryId, assignedLetterheadId, phone, address, openingBalance } = payload;

  if (!name || !name.trim()) return { success: false, reason: 'Customer name is required.' };
  if (!['retail', 'wholesale'].includes(customerType)) return { success: false, reason: 'Customer type must be retail or wholesale.' };

  const result = db
    .prepare(
      `INSERT INTO customers (name, customer_type, category_id, assigned_letterhead_id, phone, address, opening_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name.trim(),
      customerType,
      categoryId || null,
      assignedLetterheadId || null,
      phone || null,
      address || null,
      Number(openingBalance) || 0
    );

  return { success: true, id: result.lastInsertRowid };
}

// Opening balance is deliberately not editable here — the form shows it
// read-only and points the admin at Record Payment / the ledger instead.
function update(payload) {
  const db = getDb();
  const { id, name, customerType, categoryId, assignedLetterheadId, phone, address } = payload;

  if (!id) return { success: false, reason: 'Missing customer id.' };
  if (!name || !name.trim()) return { success: false, reason: 'Customer name is required.' };
  if (!['retail', 'wholesale'].includes(customerType)) return { success: false, reason: 'Customer type must be retail or wholesale.' };

  db.prepare(
    `UPDATE customers
     SET name = ?, customer_type = ?, category_id = ?, assigned_letterhead_id = ?, phone = ?, address = ?
     WHERE id = ?`
  ).run(name.trim(), customerType, categoryId || null, assignedLetterheadId || null, phone || null, address || null, id);

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
      `SELECT id, name, customer_type, phone FROM customers
       WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?)
       ORDER BY name LIMIT 20`
    )
    .all(like, like);

  return rows.map((r) => ({ ...r, balance_owed: getCustomerBalance(db, r.id) }));
}

function getLedger(customerId) {
  const db = getDb();
  const customer = db
    .prepare(
      `SELECT c.*, cc.name AS category_name FROM customers c
       LEFT JOIN customer_categories cc ON cc.id = c.category_id
       WHERE c.id = ?`
    )
    .get(customerId);
  if (!customer) return { success: false, reason: 'Customer not found.' };

  const sales = db
    .prepare('SELECT id, invoice_no, total_amount, created_at FROM sales WHERE customer_id = ? ORDER BY created_at')
    .all(customerId);
  const payments = db
    .prepare(
      "SELECT id, amount, payment_method, note, created_at FROM payments WHERE party_type = 'customer' AND party_id = ? ORDER BY created_at"
    )
    .all(customerId);

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
      reference: p.payment_method,
      note: p.note,
      debit: 0,
      credit: p.amount,
      sortKey: `${p.created_at}_1_${p.id}`,
    })),
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
      category_name: customer.category_name,
      phone: customer.phone,
      address: customer.address,
      opening_balance: customer.opening_balance,
      created_at: customer.created_at,
    },
    transactions: withBalance,
    balance: running,
  };
}

// ---------------- Customer Categories (Net Rate) ----------------

function listCategories() {
  const db = getDb();
  return db
    .prepare(
      `SELECT cc.id, cc.name, cc.description,
              (SELECT COUNT(*) FROM customers WHERE category_id = cc.id) AS customer_count
       FROM customer_categories cc
       ORDER BY cc.name`
    )
    .all();
}

function createCategory({ name, description }) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Category name is required.' };

  try {
    const result = db
      .prepare('INSERT INTO customer_categories (name, description) VALUES (?, ?)')
      .run(name.trim(), description || null);
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'A category with that name already exists.' };
    return { success: false, reason: 'Could not create category.' };
  }
}

function updateCategory({ id, name, description }) {
  const db = getDb();
  if (!name || !name.trim()) return { success: false, reason: 'Category name is required.' };

  try {
    db.prepare('UPDATE customer_categories SET name = ?, description = ? WHERE id = ?').run(name.trim(), description || null, id);
    return { success: true };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'A category with that name already exists.' };
    return { success: false, reason: 'Could not update category.' };
  }
}

function deleteCategory({ id }) {
  const db = getDb();
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM customers WHERE category_id = ?').get(id);
  if (count > 0) {
    return { success: false, reason: `Reassign ${count} customer${count === 1 ? '' : 's'} before deleting this category.` };
  }
  db.prepare('DELETE FROM customer_categories WHERE id = ?').run(id);
  return { success: true };
}

// ---------------- Net-rate price matrix ----------------

function getCategoryPrices({ categoryId }) {
  const db = getDb();

  const units = db
    .prepare(
      `SELECT pu.id, pu.product_id, p.name AS product_name, pu.unit_name,
              pu.retail_price, pu.wholesale_price, pcp.price AS override_price
       FROM product_units pu
       JOIN products p ON p.id = pu.product_id AND p.is_active = 1
       LEFT JOIN product_category_prices pcp ON pcp.product_unit_id = pu.id AND pcp.customer_category_id = ?
       ORDER BY p.name, pu.unit_name`
    )
    .all(categoryId);

  const byProduct = new Map();
  for (const u of units) {
    if (!byProduct.has(u.product_id)) byProduct.set(u.product_id, { productId: u.product_id, productName: u.product_name, units: [] });
    byProduct.get(u.product_id).units.push({
      id: u.id,
      unitName: u.unit_name,
      retailPrice: u.retail_price,
      wholesalePrice: u.wholesale_price,
      overridePrice: u.override_price,
    });
  }

  return [...byProduct.values()];
}

function upsertCategoryPrice({ productUnitId, customerCategoryId, price }) {
  const db = getDb();

  if (price === null || price === '' || price === undefined) {
    db.prepare('DELETE FROM product_category_prices WHERE product_unit_id = ? AND customer_category_id = ?').run(
      productUnitId,
      customerCategoryId
    );
    return { success: true, cleared: true };
  }

  db.prepare(
    `INSERT INTO product_category_prices (product_unit_id, customer_category_id, price)
     VALUES (?, ?, ?)
     ON CONFLICT(product_unit_id, customer_category_id) DO UPDATE SET price = excluded.price`
  ).run(productUnitId, customerCategoryId, Number(price));

  return { success: true };
}

// ---------------- Percentage Pricing Rules ----------------

function listPercentageRules() {
  const db = getDb();
  return db
    .prepare(
      `SELECT ppr.id, ppr.percentage, p.name AS product_name,
              c.name AS customer_name, cc.name AS category_name
       FROM percentage_pricing_rules ppr
       JOIN products p ON p.id = ppr.product_id
       LEFT JOIN customers c ON c.id = ppr.customer_id
       LEFT JOIN customer_categories cc ON cc.id = ppr.customer_category_id
       ORDER BY p.name`
    )
    .all();
}

// Only products actually eligible for a percentage-style rule — plain
// fixed-price items don't need one.
function listEligibleProducts() {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, name FROM products
       WHERE is_active = 1 AND (pricing_type = 'percentage' OR is_agency_item = 1)
       ORDER BY name`
    )
    .all();
}

function createPercentageRule({ productId, targetType, customerId, customerCategoryId, percentage }) {
  const db = getDb();

  if (!productId) return { success: false, reason: 'Select a product.' };
  if (percentage === undefined || percentage === null || Number.isNaN(Number(percentage))) {
    return { success: false, reason: 'Enter a valid percentage.' };
  }

  if (targetType === 'customer') {
    if (!customerId) return { success: false, reason: 'Select a customer.' };
    db.prepare(
      'INSERT INTO percentage_pricing_rules (product_id, customer_id, customer_category_id, percentage) VALUES (?, ?, NULL, ?)'
    ).run(productId, customerId, Number(percentage));
  } else if (targetType === 'category') {
    if (!customerCategoryId) return { success: false, reason: 'Select a customer category.' };
    db.prepare(
      'INSERT INTO percentage_pricing_rules (product_id, customer_id, customer_category_id, percentage) VALUES (?, NULL, ?, ?)'
    ).run(productId, customerCategoryId, Number(percentage));
  } else {
    return { success: false, reason: 'Choose a target: specific customer or whole category.' };
  }

  return { success: true };
}

function deletePercentageRule({ id }) {
  const db = getDb();
  db.prepare('DELETE FROM percentage_pricing_rules WHERE id = ?').run(id);
  return { success: true };
}

function registerCustomersIpc() {
  ipcMain.handle('customers:list', (event, payload) => list(payload || {}));
  ipcMain.handle('customers:get-by-id', (event, { id } = {}) => getById(id));
  ipcMain.handle('customers:create', (event, payload) => create(payload || {}));
  ipcMain.handle('customers:update', (event, payload) => update(payload || {}));
  ipcMain.handle('customers:set-active', (event, payload) => setActive(payload || {}));
  ipcMain.handle('customers:search-minimal', (event, payload) => searchMinimal(payload || {}));
  ipcMain.handle('customers:get-ledger', (event, { id } = {}) => getLedger(id));

  ipcMain.handle('customer-categories:list', () => listCategories());
  ipcMain.handle('customer-categories:create', (event, payload) => createCategory(payload || {}));
  ipcMain.handle('customer-categories:update', (event, payload) => updateCategory(payload || {}));
  ipcMain.handle('customer-categories:delete', (event, payload) => deleteCategory(payload || {}));

  ipcMain.handle('category-prices:get-for-category', (event, payload) => getCategoryPrices(payload || {}));
  ipcMain.handle('category-prices:upsert', (event, payload) => upsertCategoryPrice(payload || {}));

  ipcMain.handle('percentage-rules:list', () => listPercentageRules());
  ipcMain.handle('percentage-rules:list-eligible-products', () => listEligibleProducts());
  ipcMain.handle('percentage-rules:create', (event, payload) => createPercentageRule(payload || {}));
  ipcMain.handle('percentage-rules:delete', (event, payload) => deletePercentageRule(payload || {}));
}

module.exports = { registerCustomersIpc };
