PRAGMA foreign_keys = OFF;

-- Expense Categories are removed. Expenses are now typed by recurrence
-- (one_time/daily/weekly/monthly/annually) instead, and record a free-text
-- payee. Recurring expenses are driven by the new recurring_expenses table:
-- generateDueRecurringExpenses() (src/main/expenses/recurringExpenses.js)
-- materializes a real row into `expenses` here as each due date arrives —
-- the template itself never appears in All Expenses. Enum validity
-- (frequency/recurrence values) is enforced in JS, same convention as
-- customers.tier (018_fixed_tier_pricing.sql), not via CHECK on every column.
CREATE TABLE IF NOT EXISTS recurring_expenses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    description   TEXT NOT NULL,
    amount        REAL NOT NULL,
    payee         TEXT,
    paid_by       INTEGER REFERENCES users(id),
    frequency     TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'annually')),
    start_date    TEXT NOT NULL,
    next_run_date TEXT NOT NULL,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_due ON recurring_expenses(active, next_run_date);

-- idx_expenses_category (007_indexes.sql) indexes the column being dropped —
-- SQLite's DROP COLUMN doesn't drop dependent indexes on its own.
DROP INDEX IF EXISTS idx_expenses_category;

ALTER TABLE expenses DROP COLUMN category_id;
ALTER TABLE expenses ADD COLUMN payee TEXT;
ALTER TABLE expenses ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'one_time';
ALTER TABLE expenses ADD COLUMN recurring_expense_id INTEGER REFERENCES recurring_expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_recurring_expense_id ON expenses(recurring_expense_id);

DROP TABLE IF EXISTS expense_categories;

PRAGMA foreign_keys = ON;
