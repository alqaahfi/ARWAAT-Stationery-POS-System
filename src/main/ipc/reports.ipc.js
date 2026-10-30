const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const { getDb } = require('../db/connection');
const { getCaller } = require('../security/ipcGuard');
const ProductModel = require('../db/models/Product');
const { getBalancesForCustomers, getBalancesForSuppliers } = require('../ledger/balanceEngine');
const { exportReportToPdf } = require('../printing/exportReportPdf');
const { generateDueRecurringExpenses } = require('../expenses/recurringExpenses');
const { RECURRENCE_LABELS } = require('../../shared/expenseRecurrence');

// Every handler returns the same envelope so the renderer's shared
// ReportSummaryCards / table / ExportButtons / PrintReport components can all
// work generically off `{ summary, columns, rows }` regardless of report type:
//   summary: [{ label, value, accentKey }]   accentKey: 'blue'|'green'|'amber'|'purple'
//   columns: [{ key, label, format }]        format: 'currency'|'date'|'number'|'text'
//   rows:    raw (unformatted) row objects — formatting happens in the renderer
//   chartData: report-specific shape, only consumed by the interactive page

function dateRangeParams(filters) {
  const from = filters?.dateFrom || '0001-01-01';
  const to = filters?.dateTo || '9999-12-31';
  return { from, to };
}

// ---------------- 1. Sales Report ----------------
// Money rules shared by every date-ranged report here: sales/returns are
// stored in UTC (datetime('now')) but filtered and grouped by the shop's
// LOCAL calendar day, and a return reduces sales on the day it was made.

function getSalesReport(filters, requestingUserId) {
  const db = getDb();
  const { from, to } = dateRangeParams(filters);

  // Cashier access is locked server-side — a non-admin caller can never see
  // another cashier's sales, no matter what cashierId a crafted call passes.
  let lockedCashierId = filters?.cashierId || null;
  if (requestingUserId) {
    const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(requestingUserId);
    if (requester && requester.role !== 'admin') lockedCashierId = requestingUserId;
  }

  // Same sale filters apply to both queries (returns are filtered by their
  // original sale's cashier / type / payment status).
  let saleFilterSql = '';
  const saleFilterParams = [];
  if (lockedCashierId) {
    saleFilterSql += ' AND s.cashier_id = ?';
    saleFilterParams.push(lockedCashierId);
  }
  if (filters?.saleType && filters.saleType !== 'all') {
    saleFilterSql += ' AND s.sale_type = ?';
    saleFilterParams.push(filters.saleType);
  }
  if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
    saleFilterSql += ' AND s.payment_status = ?';
    saleFilterParams.push(filters.paymentStatus);
  }

  const rows = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.created_at, date(s.created_at, 'localtime') AS sale_day, s.sale_type, s.total_amount,
              s.discount_amount, s.payment_status, s.cashier_id, u.full_name AS cashier_name,
              s.customer_id, c.name AS customer_name
       FROM sales s
       JOIN users u ON u.id = s.cashier_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE date(s.created_at, 'localtime') BETWEEN date(?) AND date(?) AND s.is_voided = 0${saleFilterSql}
       ORDER BY s.created_at`
    )
    .all(from, to, ...saleFilterParams);

  const returnsByDay = db
    .prepare(
      `SELECT date(r.created_at, 'localtime') AS day, COUNT(*) AS count, COALESCE(SUM(r.total_amount), 0) AS total
       FROM sale_returns r
       JOIN sales s ON s.id = r.sale_id
       WHERE date(r.created_at, 'localtime') BETWEEN date(?) AND date(?)${saleFilterSql}
       GROUP BY day`
    )
    .all(from, to, ...saleFilterParams);

  const grossRevenue = rows.reduce((sum, r) => sum + r.total_amount, 0);
  const returnsTotal = returnsByDay.reduce((sum, r) => sum + r.total, 0);
  const returnsCount = returnsByDay.reduce((sum, r) => sum + r.count, 0);
  const totalRevenue = grossRevenue - returnsTotal;
  const salesCount = rows.length;
  const avgSaleValue = salesCount > 0 ? grossRevenue / salesCount : 0;
  const retailTotal = rows.filter((r) => r.sale_type === 'retail').reduce((s, r) => s + r.total_amount, 0);
  const wholesaleTotal = rows.filter((r) => r.sale_type === 'wholesale').reduce((s, r) => s + r.total_amount, 0);

  const byDay = {};
  const dayOf = (day) => (byDay[day] = byDay[day] || { date: day, revenue: 0, gross: 0, returns: 0 });
  for (const r of rows) dayOf(r.sale_day).gross += r.total_amount;
  for (const r of returnsByDay) dayOf(r.day).returns += r.total;
  const chartData = Object.keys(byDay)
    .sort()
    .map((day) => ({ ...byDay[day], revenue: byDay[day].gross - byDay[day].returns }));

  const summary = [
    { label: 'Net Sales', value: totalRevenue, accentKey: 'blue', format: 'currency' },
    { label: 'Total Sales', value: salesCount, accentKey: 'green', format: 'number' },
    { label: 'Average Sale Value', value: avgSaleValue, accentKey: 'amber', format: 'currency' },
    { label: 'Retail vs Wholesale', value: `${retailTotal.toFixed(0)} / ${wholesaleTotal.toFixed(0)}`, accentKey: 'purple', format: 'text' },
  ];
  if (returnsTotal > 0) {
    summary.push({ label: 'Returns', value: returnsTotal, accentKey: 'amber', format: 'currency' });
    summary.push({ label: 'Before Returns', value: grossRevenue, accentKey: 'blue', format: 'currency' });
  }

  return {
    success: true,
    isCashierScoped: !!lockedCashierId,
    summary,
    netRevenue: totalRevenue,
    grossRevenue,
    returnsTotal,
    returnsCount,
    salesCount,
    avgSaleValue,
    retailTotal,
    wholesaleTotal,
    chartData,
    columns: [
      { key: 'invoice_no', label: 'Invoice No', format: 'text' },
      { key: 'created_at', label: 'Date', format: 'date' },
      { key: 'customer_name', label: 'Customer', format: 'text' },
      { key: 'cashier_name', label: 'Cashier', format: 'text' },
      { key: 'sale_type', label: 'Type', format: 'text' },
      { key: 'total_amount', label: 'Total', format: 'currency' },
      { key: 'payment_status', label: 'Payment Status', format: 'text' },
    ],
    rows: rows.map((r) => ({ ...r, customer_name: r.customer_name || 'Walk-in' })),
  };
}

// ---------------- 2. Profit & Loss ----------------

// `expr(col, local)` builds the bucket expression for a column: local=true
// for UTC datetime('now') timestamps (sales, returns), false for columns that
// already hold a user-entered local calendar date (expense_date).
function pickBucket(from, to) {
  const days = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
  const mod = (local) => (local ? ", 'localtime'" : '');
  if (days <= 31) return { unit: 'day', expr: (col, local) => `date(${col}${mod(local)})` };
  if (days <= 180) return { unit: 'week', expr: (col, local) => `strftime('%Y-W%W', ${col}${mod(local)})` };
  return { unit: 'month', expr: (col, local) => `strftime('%Y-%m', ${col}${mod(local)})` };
}

function getProfitLoss(filters) {
  generateDueRecurringExpenses();
  const db = getDb();
  const { from, to } = dateRangeParams(filters);
  const bucket = pickBucket(from, to);
  const salesExpr = bucket.expr('s.created_at', true);
  const returnExpr = bucket.expr('r.created_at', true);
  const expenseExpr = bucket.expr('e.expense_date', false);

  const revenueRows = db
    .prepare(
      `SELECT ${salesExpr} AS bucket, COALESCE(SUM(s.total_amount), 0) AS revenue
       FROM sales s WHERE date(s.created_at, 'localtime') BETWEEN date(?) AND date(?) AND s.is_voided = 0 GROUP BY bucket`
    )
    .all(from, to);

  // Returns reduce sales on the day the return was made.
  const returnRows = db
    .prepare(
      `SELECT ${returnExpr} AS bucket, COALESCE(SUM(r.total_amount), 0) AS returns
       FROM sale_returns r WHERE date(r.created_at, 'localtime') BETWEEN date(?) AND date(?) GROUP BY bucket`
    )
    .all(from, to);

  // cost_price on product_units is already per-selling-unit (same convention
  // as retail_price/wholesale_price) — so quantity (in that unit) * cost_price
  // is the line's cost directly, no conversion_factor multiplication needed.
  const cogsRows = db
    .prepare(
      `SELECT ${salesExpr} AS bucket, COALESCE(SUM((si.quantity + si.foc_quantity) * pu.cost_price), 0) AS cogs
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN product_units pu ON pu.id = si.product_unit_id
       WHERE date(s.created_at, 'localtime') BETWEEN date(?) AND date(?) AND s.is_voided = 0
       GROUP BY bucket`
    )
    .all(from, to);

  // Returned items that went back on the shelf are no longer a cost (same
  // current-cost-price lookup as above; return quantities are in the unit
  // sold). Returned-but-not-restocked items keep their cost as a loss.
  const returnedCostRows = db
    .prepare(
      `SELECT ${returnExpr} AS bucket, COALESCE(SUM(sri.quantity * pu.cost_price), 0) AS returnedCost
       FROM sale_return_items sri
       JOIN sale_returns r ON r.id = sri.return_id
       JOIN sale_items si ON si.id = sri.sale_item_id
       JOIN product_units pu ON pu.id = si.product_unit_id
       WHERE r.restocked = 1 AND date(r.created_at, 'localtime') BETWEEN date(?) AND date(?)
       GROUP BY bucket`
    )
    .all(from, to);

  const expenseRows = db
    .prepare(
      `SELECT ${expenseExpr} AS bucket, COALESCE(SUM(e.amount), 0) AS expenses
       FROM expenses e WHERE date(e.expense_date) BETWEEN date(?) AND date(?) GROUP BY bucket`
    )
    .all(from, to);

  const buckets = {};
  const at = (key) => (buckets[key] = buckets[key] || { bucket: key, gross: 0, returns: 0, cogs: 0, returnedCost: 0, expenses: 0 });
  for (const r of revenueRows) at(r.bucket).gross = r.revenue;
  for (const r of returnRows) at(r.bucket).returns = r.returns;
  for (const r of cogsRows) at(r.bucket).cogs = r.cogs;
  for (const r of returnedCostRows) at(r.bucket).returnedCost = r.returnedCost;
  for (const r of expenseRows) at(r.bucket).expenses = r.expenses;

  const rows = Object.values(buckets)
    .sort((a, b) => (a.bucket < b.bucket ? -1 : 1))
    .map(({ bucket: key, gross, returns, cogs, returnedCost, expenses }) => {
      const revenue = gross - returns;
      const netCogs = cogs - returnedCost;
      return { bucket: key, revenue, cogs: netCogs, expenses, netProfit: revenue - netCogs - expenses, grossRevenue: gross, returns };
    });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0);
  const totalExpenses = rows.reduce((s, r) => s + r.expenses, 0);
  const returnsTotal = rows.reduce((s, r) => s + r.returns, 0);
  const netProfit = totalRevenue - totalCogs - totalExpenses;

  const summary = [
    { label: 'Net Sales', value: totalRevenue, accentKey: 'blue', format: 'currency' },
    { label: 'Cost of Goods', value: totalCogs, accentKey: 'amber', format: 'currency' },
    { label: 'Total Expenses', value: totalExpenses, accentKey: 'purple', format: 'currency' },
    { label: 'Profit', value: netProfit, accentKey: netProfit >= 0 ? 'green' : 'amber', format: 'currency' },
  ];
  if (returnsTotal > 0) summary.push({ label: 'Returns', value: returnsTotal, accentKey: 'amber', format: 'currency' });

  return {
    success: true,
    bucketUnit: bucket.unit,
    summary,
    totals: { revenue: totalRevenue, cogs: totalCogs, expenses: totalExpenses, netProfit },
    returnsTotal,
    chartData: rows.map((r) => ({ bucket: r.bucket, Revenue: r.revenue, Cost: r.cogs, Expenses: r.expenses })),
    columns: [
      { key: 'bucket', label: bucket.unit === 'day' ? 'Date' : bucket.unit === 'week' ? 'Week' : 'Month', format: 'text' },
      { key: 'revenue', label: 'Net Sales', format: 'currency' },
      { key: 'cogs', label: 'Cost of Goods', format: 'currency' },
      { key: 'expenses', label: 'Expenses', format: 'currency' },
      { key: 'netProfit', label: 'Profit', format: 'currency' },
    ],
    rows,
  };
}

// ---------------- 3. Stock Report ----------------

function getStockReport(filters) {
  const db = getDb();
  const categoryId = filters?.categoryId || null;

  const products = db
    .prepare(
      `SELECT p.id, p.name, c.name AS category_name, p.min_stock_alert, p.dead_stock_days,
              COALESCE(SUM(pv.stock_qty), 0) AS total_stock,
              MAX(pv.last_sold_at) AS last_sold_at
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
       WHERE p.is_active = 1 AND (@categoryId IS NULL OR p.category_id = @categoryId)
       GROUP BY p.id
       ORDER BY p.name`
    )
    .all({ categoryId });

  // Cost per base unit isn't stored directly (product_units.cost_price is per
  // selling-unit, e.g. per Dozen) — approximate it from the unit with the
  // smallest conversion_factor (typically the base "Piece" unit itself).
  const unitRows = db.prepare('SELECT product_id, conversion_factor, cost_price FROM product_units WHERE is_active = 1').all();
  const baseUnitByProduct = {};
  for (const u of unitRows) {
    const current = baseUnitByProduct[u.product_id];
    if (!current || u.conversion_factor < current.conversion_factor) baseUnitByProduct[u.product_id] = u;
  }

  const lowStockIds = new Set(ProductModel.getLowStock(db, categoryId).map((r) => r.id));
  const deadStockIds = new Set(ProductModel.getDeadStock(db, categoryId).map((r) => r.id));

  const rows = products.map((p) => {
    const baseUnit = baseUnitByProduct[p.id];
    const costPerBaseUnit = baseUnit ? baseUnit.cost_price / (baseUnit.conversion_factor || 1) : 0;
    const valuation = p.total_stock * costPerBaseUnit;
    const status = lowStockIds.has(p.id) ? 'Low' : deadStockIds.has(p.id) ? 'Dead' : 'Normal';
    return {
      id: p.id,
      name: p.name,
      category_name: p.category_name || '—',
      total_stock: p.total_stock,
      valuation,
      status,
    };
  });

  const totalValuation = rows.reduce((s, r) => s + r.valuation, 0);
  const byCategory = {};
  for (const r of rows) {
    const key = r.category_name;
    byCategory[key] = (byCategory[key] || 0) + r.valuation;
  }

  return {
    success: true,
    summary: [
      { label: 'Total Stock Valuation', value: totalValuation, accentKey: 'blue', format: 'currency' },
      { label: 'Total Distinct Products', value: rows.length, accentKey: 'green', format: 'number' },
      { label: 'Low Stock Count', value: lowStockIds.size, accentKey: 'amber', format: 'number' },
      { label: 'Dead Stock Count', value: deadStockIds.size, accentKey: 'purple', format: 'number' },
    ],
    chartData: Object.keys(byCategory).map((name) => ({ name, valuation: byCategory[name] })),
    columns: [
      { key: 'name', label: 'Product', format: 'text' },
      { key: 'category_name', label: 'Category', format: 'text' },
      { key: 'total_stock', label: 'Total Stock', format: 'number' },
      { key: 'valuation', label: 'Valuation', format: 'currency' },
      { key: 'status', label: 'Status', format: 'text' },
    ],
    rows,
  };
}

// ---------------- 4. Customer Statements ----------------

function getCustomerStatements(filters) {
  const db = getDb();
  let sql = `
    SELECT c.id, c.name, c.customer_type, c.tier, c.opening_balance
    FROM customers c
    WHERE c.is_active = 1
  `;
  const params = [];
  if (filters?.tier === 'NONE') {
    sql += ' AND c.tier IS NULL';
  } else if (filters?.tier) {
    sql += ' AND c.tier = ?';
    params.push(filters.tier);
  }
  sql += ' ORDER BY c.name';

  const customers = db.prepare(sql).all(...params);
  const balances = getBalancesForCustomers(db, customers.map((c) => c.id));

  let rows = customers.map((c) => ({ ...c, balance_owed: balances[c.id] ?? c.opening_balance }));
  if (filters?.onlyWithBalance) rows = rows.filter((r) => r.balance_owed > 0);
  rows.sort((a, b) => b.balance_owed - a.balance_owed);

  const totalReceivable = rows.reduce((s, r) => s + Math.max(0, r.balance_owed), 0);
  const countWithBalance = rows.filter((r) => r.balance_owed > 0).length;
  const highestBalance = rows.reduce((m, r) => Math.max(m, r.balance_owed), 0);
  const highestRow = rows.find((r) => r.balance_owed > 0 && r.balance_owed === highestBalance);

  return {
    success: true,
    totalReceivable,
    highestBalanceName: highestRow ? highestRow.name : null,
    summary: [
      { label: 'Total Receivable', value: totalReceivable, accentKey: 'blue', format: 'currency' },
      { label: 'Customers With Balance', value: countWithBalance, accentKey: 'amber', format: 'number' },
      { label: 'Highest Single Balance', value: highestBalance, accentKey: 'purple', format: 'currency' },
    ],
    columns: [
      { key: 'id', label: 'Customer ID', format: 'text' },
      { key: 'name', label: 'Customer Name', format: 'text' },
      { key: 'customer_type', label: 'Type', format: 'text' },
      { key: 'tier', label: 'Tier', format: 'text' },
      { key: 'balance_owed', label: 'Balance Owed', format: 'currency' },
    ],
    rows,
  };
}

// ---------------- 5. Supplier Statements ----------------

function getSupplierStatements(filters) {
  const db = getDb();
  const suppliers = db.prepare('SELECT id, name, contact_person, phone FROM suppliers WHERE is_active = 1 ORDER BY name').all();
  const balances = getBalancesForSuppliers(db, suppliers.map((s) => s.id));

  let rows = suppliers.map((s) => ({ ...s, balance_owed: balances[s.id] ?? 0 }));
  if (filters?.onlyWithBalance) rows = rows.filter((r) => r.balance_owed > 0);
  rows.sort((a, b) => b.balance_owed - a.balance_owed);

  const totalPayable = rows.reduce((s, r) => s + Math.max(0, r.balance_owed), 0);
  const countWithBalance = rows.filter((r) => r.balance_owed > 0).length;
  const highestBalance = rows.reduce((m, r) => Math.max(m, r.balance_owed), 0);
  const highestRow = rows.find((r) => r.balance_owed > 0 && r.balance_owed === highestBalance);

  return {
    success: true,
    totalPayable,
    highestBalanceName: highestRow ? highestRow.name : null,
    summary: [
      { label: 'Total Payable', value: totalPayable, accentKey: 'blue', format: 'currency' },
      { label: 'Suppliers With Balance', value: countWithBalance, accentKey: 'amber', format: 'number' },
      { label: 'Highest Single Balance', value: highestBalance, accentKey: 'purple', format: 'currency' },
    ],
    columns: [
      { key: 'name', label: 'Supplier Name', format: 'text' },
      { key: 'contact_person', label: 'Contact', format: 'text' },
      { key: 'phone', label: 'Phone', format: 'text' },
      { key: 'balance_owed', label: 'Balance Owed', format: 'currency' },
    ],
    rows,
  };
}

// ---------------- 6. Cashier Performance ----------------

function getCashierPerformance(filters) {
  const db = getDb();
  const { from, to } = dateRangeParams(filters);

  const salesRows = db
    .prepare(
      `SELECT s.cashier_id AS id,
              COUNT(s.id) AS sales_count,
              COALESCE(SUM(s.total_amount), 0) AS gross_revenue,
              COALESCE(SUM(s.discount_amount), 0) AS total_discounts
       FROM sales s
       WHERE date(s.created_at, 'localtime') BETWEEN date(?) AND date(?) AND s.is_voided = 0
       GROUP BY s.cashier_id`
    )
    .all(from, to);

  // A return counts against the cashier who made the ORIGINAL sale, on the
  // day the return was made.
  const returnRows = db
    .prepare(
      `SELECT s.cashier_id AS id, COALESCE(SUM(r.total_amount), 0) AS returns_total
       FROM sale_returns r
       JOIN sales s ON s.id = r.sale_id
       WHERE date(r.created_at, 'localtime') BETWEEN date(?) AND date(?)
       GROUP BY s.cashier_id`
    )
    .all(from, to);

  const byId = {};
  const at = (id) => (byId[id] = byId[id] || { id, sales_count: 0, gross_revenue: 0, total_discounts: 0, returns_total: 0 });
  for (const r of salesRows) Object.assign(at(r.id), r);
  for (const r of returnRows) at(r.id).returns_total = r.returns_total;

  const ids = Object.keys(byId).map(Number);
  const names = ids.length
    ? Object.fromEntries(
        db
          .prepare(`SELECT id, full_name FROM users WHERE id IN (${ids.map(() => '?').join(',')})`)
          .all(...ids)
          .map((u) => [u.id, u.full_name])
      )
    : {};

  const rows = Object.values(byId)
    .map((r) => ({
      ...r,
      full_name: names[r.id] || 'Unknown',
      total_revenue: r.gross_revenue - r.returns_total,
      avg_sale_value: r.sales_count > 0 ? r.gross_revenue / r.sales_count : 0,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue);

  const topCashier = rows[0]?.full_name || '—';
  const returnsTotal = rows.reduce((s, r) => s + r.returns_total, 0);
  const totalDiscounts = rows.reduce((s, r) => s + r.total_discounts, 0);

  return {
    success: true,
    summary: [
      { label: 'Top Performing Cashier', value: topCashier, accentKey: 'blue', format: 'text' },
      { label: 'Cashiers Active in Range', value: rows.length, accentKey: 'green', format: 'number' },
      { label: 'Discounts Given', value: totalDiscounts, accentKey: 'amber', format: 'currency' },
    ],
    returnsTotal,
    totalDiscounts,
    chartData: rows.map((r) => ({ name: r.full_name, revenue: r.total_revenue })),
    columns: [
      { key: 'full_name', label: 'Cashier Name', format: 'text' },
      { key: 'sales_count', label: 'Sales', format: 'number' },
      { key: 'total_revenue', label: 'Net Sales', format: 'currency' },
      { key: 'returns_total', label: 'Returned', format: 'currency' },
      { key: 'avg_sale_value', label: 'Average Sale', format: 'currency' },
      { key: 'total_discounts', label: 'Discounts Given', format: 'currency' },
    ],
    rows,
  };
}

// ---------------- 7. Expense Report ----------------

function getExpenseReport(filters) {
  generateDueRecurringExpenses();
  const db = getDb();
  const { from, to } = dateRangeParams(filters);

  let sql = `
    SELECT e.id, e.expense_date, e.description, e.amount, e.payee, e.recurrence,
           u.full_name AS paid_by_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.paid_by
    WHERE date(e.expense_date) BETWEEN date(?) AND date(?)
  `;
  const params = [from, to];
  if (filters?.recurrence) {
    sql += ' AND e.recurrence = ?';
    params.push(filters.recurrence);
  }
  if (filters?.search && filters.search.trim()) {
    sql += ' AND (e.description LIKE ? OR e.payee LIKE ?)';
    params.push(`%${filters.search.trim()}%`, `%${filters.search.trim()}%`);
  }
  sql += ' ORDER BY e.expense_date DESC';

  const rows = db.prepare(sql).all(...params);
  const totalExpenses = rows.reduce((s, r) => s + r.amount, 0);
  const largest = rows.reduce((m, r) => Math.max(m, r.amount), 0);

  const byRecurrence = {};
  for (const r of rows) {
    const key = RECURRENCE_LABELS[r.recurrence] || r.recurrence;
    byRecurrence[key] = (byRecurrence[key] || 0) + r.amount;
  }

  return {
    success: true,
    summary: [
      { label: 'Total Expenses', value: totalExpenses, accentKey: 'blue', format: 'currency' },
      { label: 'Number of Entries', value: rows.length, accentKey: 'green', format: 'number' },
      { label: 'Largest Single Expense', value: largest, accentKey: 'amber', format: 'currency' },
    ],
    chartData: Object.keys(byRecurrence).map((name) => ({ name, value: byRecurrence[name] })),
    columns: [
      { key: 'expense_date', label: 'Date', format: 'date' },
      { key: 'payee', label: 'Payee', format: 'text' },
      { key: 'description', label: 'Description', format: 'text' },
      { key: 'recurrence', label: 'Recurrence', format: 'text' },
      { key: 'amount', label: 'Amount', format: 'currency' },
      { key: 'paid_by_name', label: 'Paid By', format: 'text' },
    ],
    rows: rows.map((r) => ({
      ...r,
      payee: r.payee || '—',
      recurrence: RECURRENCE_LABELS[r.recurrence] || r.recurrence,
      paid_by_name: r.paid_by_name || '—',
    })),
  };
}

// ---------------- generic report dispatch (used by PrintReport too) ----------------

const REPORT_HANDLERS = {
  sales: getSalesReport,
  'profit-loss': getProfitLoss,
  stock: getStockReport,
  customers: getCustomerStatements,
  suppliers: getSupplierStatements,
  cashiers: getCashierPerformance,
  expenses: getExpenseReport,
};

function getReport(reportType, filters, requestingUserId) {
  const handler = REPORT_HANDLERS[reportType];
  if (!handler) return { success: false, reason: 'Unknown report type.' };
  return reportType === 'sales' ? handler(filters, requestingUserId) : handler(filters);
}

// ---------------- CSV export ----------------

function csvCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return /["\r\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns, rows) {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(','));
  return [header, ...lines].join('\r\n');
}

async function exportCsv({ rows, columns, suggestedName }) {
  const result = await dialog.showSaveDialog({
    title: 'Export CSV',
    defaultPath: suggestedName || 'report.csv',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };

  fs.writeFileSync(result.filePath, toCsv(columns || [], rows || []), 'utf8');
  return { success: true, filePath: result.filePath };
}

// ---------------- PDF export ----------------

async function exportPdf({ reportType, filters }) {
  return exportReportToPdf({ reportType, filters });
}

function registerReportsIpc() {
  // The acting user is always the signed-in caller (a print window acts as the
  // window that opened it), never an id from the renderer.
  ipcMain.handle('reports:get-sales-report', (event, { filters } = {}) =>
    getSalesReport(filters || {}, getCaller(event)?.userId)
  );
  ipcMain.handle('reports:get-profit-loss', (event, { filters } = {}) => getProfitLoss(filters || {}));
  ipcMain.handle('reports:get-stock-report', (event, { filters } = {}) => getStockReport(filters || {}));
  ipcMain.handle('reports:get-customer-statements', (event, { filters } = {}) => getCustomerStatements(filters || {}));
  ipcMain.handle('reports:get-supplier-statements', (event, { filters } = {}) => getSupplierStatements(filters || {}));
  ipcMain.handle('reports:get-cashier-performance', (event, { filters } = {}) => getCashierPerformance(filters || {}));
  ipcMain.handle('reports:get-expense-report', (event, { filters } = {}) => getExpenseReport(filters || {}));

  // Generic dispatch — used by the hidden print window, which only knows a
  // reportType string + filters, not which specific function to call.
  ipcMain.handle('reports:get-report', (event, { reportType, filters } = {}) =>
    getReport(reportType, filters || {}, getCaller(event)?.userId)
  );

  ipcMain.handle('reports:export-csv', (event, payload) => exportCsv(payload || {}));
  ipcMain.handle('reports:export-pdf', (event, payload) => exportPdf(payload || {}));
}

module.exports = { registerReportsIpc };
