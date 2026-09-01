const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getBalancesForCustomers, getBalancesForSuppliers } = require('../ledger/balanceEngine');

const RESULTS_PER_TYPE = 5;

// Top utility bar's global search — products (name/SKU/barcode), customers
// and suppliers (name/phone), combined into one capped result set. Reuses
// the same balance engine every other list/search screen in the app already
// calls, rather than a separate ad-hoc balance calculation here.
function search(query) {
  const db = getDb();
  const term = (query || '').trim();
  if (!term) return { products: [], customers: [], suppliers: [] };

  const like = `%${term}%`;

  const products = db
    .prepare(
      `SELECT DISTINCT p.id, p.name, p.sku, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_variants pv ON pv.product_id = p.id
       WHERE p.is_active = 1 AND (p.name LIKE ? OR p.sku LIKE ? OR pv.barcode LIKE ?)
       ORDER BY p.name
       LIMIT ${RESULTS_PER_TYPE}`
    )
    .all(like, like, like);

  const customerRows = db
    .prepare(
      `SELECT id, name, phone, customer_type
       FROM customers
       WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?)
       ORDER BY name
       LIMIT ${RESULTS_PER_TYPE}`
    )
    .all(like, like);
  const customerBalances = getBalancesForCustomers(db, customerRows.map((r) => r.id));
  const customers = customerRows.map((r) => ({ ...r, balance_owed: customerBalances[r.id] ?? 0 }));

  const supplierRows = db
    .prepare(
      `SELECT id, name, phone, contact_person
       FROM suppliers
       WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?)
       ORDER BY name
       LIMIT ${RESULTS_PER_TYPE}`
    )
    .all(like, like);
  const supplierBalances = getBalancesForSuppliers(db, supplierRows.map((r) => r.id));
  const suppliers = supplierRows.map((r) => ({ ...r, balance_owed: supplierBalances[r.id] ?? 0 }));

  return { products, customers, suppliers };
}

function registerGlobalIpc() {
  ipcMain.handle('global:search', (event, { query } = {}) => search(query));
}

module.exports = { registerGlobalIpc };
