const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const ProductModel = require('../db/models/Product');

// Aggregate numbers for the admin Overview page. Kept as one round trip so the
// dashboard renders with a single call instead of one IPC per stat tile.
function getSummary() {
  const db = getDb();

  const todaySales = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
       FROM sales
       WHERE date(created_at) = date('now')`
    )
    .get();

  const totalProducts = db
    .prepare(`SELECT COUNT(*) AS count FROM products WHERE is_active = 1`)
    .get().count;

  // Same query the Products module and Stock Report already use — one
  // definition, reused everywhere a low/dead stock count is needed.
  const lowStockCount = ProductModel.getLowStock(db).length;
  const deadStockCount = ProductModel.getDeadStock(db).length;

  const totalCustomers = db
    .prepare(`SELECT COUNT(*) AS count FROM customers WHERE is_active = 1`)
    .get().count;

  const outstandingReceivables = db
    .prepare(`SELECT COALESCE(SUM(balance_due), 0) AS total FROM sales WHERE payment_status != 'paid'`)
    .get().total;

  const monthExpenses = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')`
    )
    .get().total;

  const recentSales = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.sale_type, s.total_amount, s.payment_status, s.created_at,
              c.name AS customer_name, u.full_name AS cashier_name
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       JOIN users u ON u.id = s.cashier_id
       ORDER BY s.created_at DESC
       LIMIT 5`
    )
    .all();

  return {
    todaySalesTotal: todaySales.total,
    todaySalesCount: todaySales.count,
    totalProducts,
    lowStockCount,
    deadStockCount,
    totalCustomers,
    outstandingReceivables,
    monthExpenses,
    recentSales,
  };
}

// Daily revenue for the last N days (7/30/90, from the Dashboard's period
// toggle), zero-filled so a day with no sales still shows as a gap rather
// than being skipped — same chartData shape as the Reports module's Sales
// Report, so the Dashboard's bar-click drill-down works exactly the same way.
function getRevenueTrend(days) {
  const db = getDb();
  const n = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;

  const rows = db
    .prepare(
      `SELECT date(created_at) AS day, COALESCE(SUM(total_amount), 0) AS revenue
       FROM sales
       WHERE date(created_at) >= date('now', ?)
       GROUP BY day`
    )
    .all(`-${n - 1} days`);

  const byDay = Object.fromEntries(rows.map((r) => [r.day, r.revenue]));
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, revenue: byDay[key] || 0 });
  }
  return result;
}

// Sessions are local to this PC until the Sync module exists to share
// connection state between PCs — so "station" here is always just this PC's
// own station_code, attached to every row (this PC's sessions table can only
// ever contain sessions created from this PC).
function getActiveSessions() {
  const db = getDb();
  const activation = db.prepare('SELECT station_code FROM license_activation WHERE id = 1').get();
  const stationCode = activation?.station_code || null;

  const rows = db
    .prepare(
      `SELECT s.id, u.full_name, u.role, s.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.is_revoked = 0 AND s.expires_at > datetime('now')
       ORDER BY s.created_at DESC`
    )
    .all();

  return rows.map((r) => ({ ...r, stationCode }));
}

function registerDashboardIpc() {
  ipcMain.handle('dashboard:get-summary', () => getSummary());
  ipcMain.handle('dashboard:get-revenue-trend', (event, { days } = {}) => getRevenueTrend(days));
  ipcMain.handle('dashboard:get-active-sessions', () => getActiveSessions());
}

module.exports = { registerDashboardIpc };
