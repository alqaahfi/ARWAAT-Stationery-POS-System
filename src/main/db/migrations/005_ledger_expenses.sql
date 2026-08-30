PRAGMA foreign_keys = ON;

-- All money movement in/out with customers and suppliers. A customer/supplier's
-- running balance is derived from sales + payments, never stored directly.
CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    party_type      TEXT NOT NULL CHECK(party_type IN ('customer','supplier')),
    party_id        INTEGER NOT NULL,     -- customers.id or suppliers.id, depending on party_type
    sale_id         INTEGER REFERENCES sales(id) ON DELETE SET NULL,
    amount          REAL NOT NULL,
    payment_method  TEXT NOT NULL DEFAULT 'cash' CHECK(payment_method IN ('cash','bank','other')),
    note            TEXT,
    received_by     INTEGER REFERENCES users(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expense_categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS expenses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id  INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
    description  TEXT NOT NULL,
    amount       REAL NOT NULL,
    paid_by      INTEGER REFERENCES users(id),
    expense_date TEXT NOT NULL DEFAULT (datetime('now')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
