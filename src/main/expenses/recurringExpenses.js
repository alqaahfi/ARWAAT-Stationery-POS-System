const { getDb } = require('../db/connection');
const { addPeriod } = require('../../shared/expenseRecurrence');

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Materializes real `expenses` rows for every active recurring_expenses
// template whose next occurrence is due (next_run_date <= today), advancing
// next_run_date past today each time. Catches up on any dates missed while
// the app was closed (e.g. a weekly expense over a two-week gap generates
// both missed occurrences) rather than silently skipping them.
//
// Safe to call as often as wanted — it's a no-op query when nothing is due.
// Called at app startup (main/index.js) and again at the top of every
// handler that reads the expenses table (expenses:list, the expense report,
// profit & loss), so the data is always fresh no matter how long the app has
// stayed open.
function generateDueRecurringExpenses() {
  const db = getDb();
  const today = todayIso();

  const due = db.prepare(`SELECT * FROM recurring_expenses WHERE active = 1 AND next_run_date <= ?`).all(today);
  if (due.length === 0) return;

  const insertExpense = db.prepare(
    `INSERT INTO expenses (description, amount, payee, paid_by, expense_date, recurrence, recurring_expense_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const advanceTemplate = db.prepare(`UPDATE recurring_expenses SET next_run_date = ? WHERE id = ?`);

  const generateForTemplate = db.transaction((template) => {
    let nextRun = template.next_run_date;
    let guard = 0;
    // Bounded catch-up: even a daily template left inactive-in-practice for
    // years stops generating after this many occurrences in one pass rather
    // than locking up the app on a corrupted/ancient next_run_date.
    while (nextRun <= today && guard < 2000) {
      insertExpense.run(
        template.description,
        template.amount,
        template.payee,
        template.paid_by,
        `${nextRun} 00:00:00`,
        template.frequency,
        template.id
      );
      nextRun = addPeriod(nextRun, template.frequency);
      guard += 1;
    }
    advanceTemplate.run(nextRun, template.id);
  });

  for (const template of due) generateForTemplate(template);
}

module.exports = { generateDueRecurringExpenses };
