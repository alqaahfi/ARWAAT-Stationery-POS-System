PRAGMA foreign_keys = ON;

-- Set when a session ends (explicit logout, or revoked by an admin
-- deactivating/resetting the account) — lets the Cashiers > Session Activity
-- screen show login/logout time and duration without guessing from expiry.
ALTER TABLE sessions ADD COLUMN ended_at TEXT;

-- One row per notable thing a cashier did during a session — the detail view
-- behind a session row in Session Activity. session_id is nullable (rather
-- than cascading the row away) so activity survives even if its session were
-- ever removed.
CREATE TABLE IF NOT EXISTS activity_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id     INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action         TEXT NOT NULL,          -- 'login' | 'logout' | 'sale_created' | ...
    description    TEXT,                    -- human-readable summary shown in the UI
    reference_type TEXT,                    -- e.g. 'sale'
    reference_id   INTEGER,                 -- e.g. sales.id
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_log_session ON activity_log(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
