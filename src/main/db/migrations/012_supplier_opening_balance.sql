PRAGMA foreign_keys = ON;
ALTER TABLE suppliers ADD COLUMN opening_balance REAL NOT NULL DEFAULT 0;
