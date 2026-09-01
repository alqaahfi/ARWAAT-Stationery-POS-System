const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');

// A plain "YYYY-MM-DD" from the date picker is stored space-separated with a
// zero time component, matching the shape sqlite's own datetime('now')
// produces — every date formatter in the renderer assumes that format.
// undefined/null passes through so callers can leave the date untouched.
function normalizeExpenseDate(expenseDate) {
  if (!expenseDate) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(expenseDate) ? `${expenseDate} 00:00:00` : expenseDate;
}

function list(filters = {}) {
  const db = getDb();
  const { search, categoryId, dateFrom, dateTo } = filters;

  let sql = `
    SELECT e.id, e.description, e.amount, e.expense_date, e.created_at,
           e.category_id, ec.name AS category_name,
           u.full_name AS paid_by_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    LEFT JOIN users u ON u.id = e.paid_by
    WHERE 1 = 1
  `;
  const params = [];

  if (search && search.trim()) {
    sql += ' AND e.description LIKE ?';
    params.push(`%${search.trim()}%`);
  }
  if (categoryId) {
    sql += ' AND e.category_id = ?';
    params.push(categoryId);
  }
  if (dateFrom) {
    sql += ' AND date(e.expense_date) >= date(?)';
    params.push(dateFrom);
  }
  if (dateTo) {
    sql += ' AND date(e.expense_date) <= date(?)';
    params.push(dateTo);
  }
  sql += ' ORDER BY e.expense_date DESC, e.id DESC';

  const rows = db.prepare(sql).all(...params);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  return { rows, total };
}

function getById(id) {
  const db = getDb();
  return db
    .prepare(
      `SELECT e.*, ec.name AS category_name, u.full_name AS paid_by_name
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       LEFT JOIN users u ON u.id = e.paid_by
       WHERE e.id = ?`
    )
    .get(id);
}

function create(payload) {
  const db = getDb();
  const { description, amount, categoryId, expenseDate, paidBy } = payload;

  if (!description || !description.trim()) return { success: false, reason: 'Description is required.' };
  const amt = Number(amount);
  if (!amt || amt <= 0) return { success: false, reason: 'Enter an amount greater than zero.' };

  const result = db
    .prepare(
      `INSERT INTO expenses (category_id, description, amount, paid_by, expense_date)
       VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(categoryId || null, description.trim(), amt, paidBy || null, normalizeExpenseDate(expenseDate));

  return { success: true, id: result.lastInsertRowid };
}

// paid_by is deliberately left untouched here — it records who originally
// entered the expense, same "who did this" convention as payments.received_by.
function update(payload) {
  const db = getDb();
  const { id, description, amount, categoryId, expenseDate } = payload;

  if (!id) return { success: false, reason: 'Missing expense id.' };
  if (!description || !description.trim()) return { success: false, reason: 'Description is required.' };
  const amt = Number(amount);
  if (!amt || amt <= 0) return { success: false, reason: 'Enter an amount greater than zero.' };

  db.prepare(
    `UPDATE expenses SET category_id = ?, description = ?, amount = ?, expense_date = COALESCE(?, expense_date) WHERE id = ?`
  ).run(categoryId || null, description.trim(), amt, normalizeExpenseDate(expenseDate), id);

  return { success: true };
}

function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return { success: true };
}

function registerExpensesIpc() {
  ipcMain.handle('expenses:list', (event, payload) => list(payload || {}));
  ipcMain.handle('expenses:get-by-id', (event, { id } = {}) => getById(id));
  ipcMain.handle('expenses:create', (event, payload) => create(payload || {}));
  ipcMain.handle('expenses:update', (event, payload) => update(payload || {}));
  ipcMain.handle('expenses:delete', (event, { id } = {}) => remove(id));
}

module.exports = { registerExpensesIpc };
