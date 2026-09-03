// Single source of truth for expense recurrence types, used by main-process
// code only (expenses.ipc.js, reports.ipc.js, expenses/recurringExpenses.js).
// Plain CommonJS, same convention as permissionDefinitions.js — the renderer
// keeps its own small copy (src/renderer/utils/expenseRecurrence.js) instead
// of importing this CJS file into the Vite bundle.

// Recurrence values a real `expenses` row can carry. 'one_time' means "just
// this one" — the other four are also the `frequency` values a
// recurring_expenses template carries (a template is never 'one_time').
const RECURRENCE_TYPES = ['one_time', 'daily', 'weekly', 'monthly', 'annually'];
const FREQUENCIES = ['daily', 'weekly', 'monthly', 'annually'];

const RECURRENCE_LABELS = {
  one_time: 'One-time',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  annually: 'Annually',
};

// Adds one period of `frequency` to a "YYYY-MM-DD" date string, entirely in
// UTC calendar terms — no time-of-day, no local-timezone drift. Month/year
// adds clamp the day-of-month to the target month's last day (e.g. Jan 31 +
// monthly -> Feb 28/29, not an overflowed Mar 3; Feb 29 + annually -> Feb 28
// on a non-leap target year).
function addPeriod(dateStr, frequency) {
  const [y, m, d] = dateStr.split('-').map(Number);

  if (frequency === 'daily') return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (frequency === 'weekly') return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);

  if (frequency === 'monthly') {
    const targetMonth = m; // zero-based next month (m is 1-based current month)
    const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, targetMonth, Math.min(d, lastDay))).toISOString().slice(0, 10);
  }

  if (frequency === 'annually') {
    const targetYear = y + 1;
    const lastDay = new Date(Date.UTC(targetYear, m, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, m - 1, Math.min(d, lastDay))).toISOString().slice(0, 10);
  }

  throw new Error(`Unknown frequency: ${frequency}`);
}

module.exports = { RECURRENCE_TYPES, FREQUENCIES, RECURRENCE_LABELS, addPeriod };
