PRAGMA foreign_keys = ON;

-- Shop-wide key/value settings (shop name, address, currency, etc.)
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- Users (admin + cashiers)
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('admin','cashier')),
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fine-grained per-cashier permissions (e.g. 'view_reports','view_cost_price','manage_expenses')
CREATE TABLE IF NOT EXISTS user_permissions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    UNIQUE(user_id, permission_key)
);

-- Login sessions (for the secure login system)
CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    is_revoked INTEGER NOT NULL DEFAULT 0
);

-- Single-row table: records this PC's activation (admin or cashier, machine-locked)
CREATE TABLE IF NOT EXISTS license_activation (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    machine_id    TEXT NOT NULL,
    shop_name     TEXT NOT NULL,
    license_key   TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('admin','cashier')),
    admin_host    TEXT,               -- cashier only: admin PC's LAN address, e.g. 192.168.1.10:4000
    activated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
