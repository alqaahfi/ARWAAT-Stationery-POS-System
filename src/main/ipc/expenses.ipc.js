const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { generateDueRecurringExpenses } = require('../expenses/recurringExpenses');
const { FREQUENCIES, addPeriod } = require('../../shared/expenseRecurrence');

// A plain "YYYY-MM-DD" from the date picker is stored space-separated with a
// zero time component, matching the shape sqlite's own datetime('now')
// produces — every date formatter in the renderer assumes that format.
// undefined/null passes through so callers can leave the date untouched.
function normalizeExpenseDate(expenseDate) {
  if (!expenseDate) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(expenseDate) ? `${expenseDate} 00:00:00` : expenseDate;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function list(filters = {}) {
  generateDueRecurringExpenses();
  const db = getDb();
  const { search, recurrence, dateFrom, dateTo } = filters;

  let sql = `
    SELECT e.id, e.description, e.amount, e.payee, e.expense_date, e.created_at,
           e.recurrence, e.recurring_expense_id,
           u.full_name AS paid_by_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.paid_by
    WHERE 1 = 1
  `;
  const params = [];

  if (search && search.trim()) {
    sql += ' AND (e.description LIKE ? OR e.payee LIKE ?)';
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }
  if (recurrence) {
    sql += ' AND e.recurrence = ?';
    params.push(recurrence);
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
      `SELECT e.*, u.full_name AS paid_by_name
       FROM expenses e
       LEFT JOIN users u ON u.id = e.paid_by
       WHERE e.id = ?`
    )
    .get(id);
}

// One-time expenses insert directly. Recurring ones (daily/weekly/monthly/
// annually) create a recurring_expenses template *and* immediately insert
// the first occurrence at the chosen date — so what the user just entered is
// visible in All Expenses right away, whether that date is today, in the
// past, or in the future — then generateDueRecurringExpenses() catches up
// any further occurrences already due (e.g. a start date months in the
// past). Every later occurrence is generated automatically as its date
// arrives.
function create(payload) {
  const db = getDb();
  const { description, amount, payee, expenseDate, paidBy, recurrence } = payload;

  if (!description || !description.trim()) return { success: false, reason: 'Description is required.' };
  const amt = Number(amount);
  if (!amt || amt <= 0) return { success: false, reason: 'Enter an amount greater than zero.' };

  const freq = FREQUENCIES.includes(recurrence) ? recurrence : 'one_time';
  const dateOnly = (expenseDate || todayDateOnly()).slice(0, 10);
  const trimmedPayee = payee && payee.trim() ? payee.trim() : null;

  if (freq === 'one_time') {
    const result = db
      .prepare(
        `INSERT INTO expenses (description, amount, payee, paid_by, expense_date, recurrence)
         VALUES (?, ?, ?, ?, ?, 'one_time')`
      )
      .run(description.trim(), amt, trimmedPayee, paidBy || null, normalizeExpenseDate(dateOnly));
    return { success: true, id: result.lastInsertRowid };
  }

  const firstOccurrence = db
    .prepare(
      `INSERT INTO expenses (description, amount, payee, paid_by, expense_date, recurrence)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(description.trim(), amt, trimmedPayee, paidBy || null, normalizeExpenseDate(dateOnly), freq);

  const template = db
    .prepare(
      `INSERT INTO recurring_expenses (description, amount, payee, paid_by, frequency, start_date, next_run_date, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(description.trim(), amt, trimmedPayee, paidBy || null, freq, dateOnly, addPeriod(dateOnly, freq));

  db.prepare('UPDATE expenses SET recurring_expense_id = ? WHERE id = ?').run(
    template.lastInsertRowid,
    firstOccurrence.lastInsertRowid
  );

  // Catches up any occurrences already due if the chosen start date was
  // further in the past than one period.
  generateDueRecurringExpenses();

  return { success: true, id: firstOccurrence.lastInsertRowid };
}

// paid_by is deliberately left untouched here — it records who originally
// entered the expense, same "who did this" convention as payments.received_by.
// recurrence itself isn't editable — it's fixed at creation; edits only
// change this one occurrence's own details, never the underlying recurring
// series (use stopRecurrence to end the series).
function update(payload) {
  const db = getDb();
  const { id, description, amount, payee, expenseDate } = payload;

  if (!id) return { success: false, reason: 'Missing expense id.' };
  if (!description || !description.trim()) return { success: false, reason: 'Description is required.' };
  const amt = Number(amount);
  if (!amt || amt <= 0) return { success: false, reason: 'Enter an amount greater than zero.' };

  db.prepare(
    `UPDATE expenses SET description = ?, amount = ?, payee = ?, expense_date = COALESCE(?, expense_date) WHERE id = ?`
  ).run(description.trim(), amt, payee && payee.trim() ? payee.trim() : null, normalizeExpenseDate(expenseDate), id);

  return { success: true };
}

function remove(id) {
  const db = getDb();
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  return { success: true };
}

// Deactivates the recurring series behind a given expense occurrence — no
// further occurrences are generated. The occurrences already generated
// (including this one) are untouched; delete them individually if wanted.
function stopRecurrence(id) {
  const db = getDb();
  const row = db.prepare('SELECT recurring_expense_id FROM expenses WHERE id = ?').get(id);
  if (!row || !row.recurring_expense_id) {
    return { success: false, reason: 'This expense is not part of a recurring series.' };
  }
  db.prepare('UPDATE recurring_expenses SET active = 0 WHERE id = ?').run(row.recurring_expense_id);
  return { success: true };
}

function registerExpensesIpc() {
  ipcMain.handle('expenses:list', (event, payload) => list(payload || {}));
  ipcMain.handle('expenses:get-by-id', (event, { id } = {}) => getById(id));
  ipcMain.handle('expenses:create', (event, payload) => create(payload || {}));
  ipcMain.handle('expenses:update', (event, payload) => update(payload || {}));
  ipcMain.handle('expenses:delete', (event, { id } = {}) => remove(id));
  ipcMain.handle('expenses:stop-recurrence', (event, { id } = {}) => stopRecurrence(id));
}

module.exports = { registerExpensesIpc };
