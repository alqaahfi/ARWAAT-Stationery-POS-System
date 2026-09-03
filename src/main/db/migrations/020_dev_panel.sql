PRAGMA foreign_keys = ON;

-- Read-only diagnostic module (Dev Panel). See src/main/devpanel/ and
-- src/main/ipc/devpanel.ipc.js. The password is never stored in source —
-- seed/change it with scripts/generate-dev-panel-hash.js, which prints the
-- INSERT below with a freshly bcrypt-hashed value.
CREATE TABLE IF NOT EXISTS dev_panel_config (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash  TEXT NOT NULL
);

-- One row per IPC call made anywhere in the app, written centrally by
-- src/main/devpanel/auditMiddleware.js (which wraps ipcMain.handle) so no
-- individual module needs to instrument itself. This is the "what happened,
-- in detail" trail the Dev Panel's Audit Log tab reads.
CREATE TABLE IF NOT EXISTS dev_audit_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at    TEXT NOT NULL DEFAULT (datetime('now')),
    channel        TEXT NOT NULL,
    user_id        INTEGER,
    user_role      TEXT,
    station_code   TEXT,
    args_summary   TEXT,
    success        INTEGER NOT NULL,
    error_message  TEXT,
    duration_ms    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_dev_audit_log_time ON dev_audit_log(occurred_at);
CREATE INDEX IF NOT EXISTS idx_dev_audit_log_channel ON dev_audit_log(channel);

-- Every attempt (success or fail) to unlock the Dev Panel itself, from any
-- PC in the shop.
CREATE TABLE IF NOT EXISTS dev_panel_access_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at    TEXT NOT NULL DEFAULT (datetime('now')),
    station_code   TEXT,
    success        INTEGER NOT NULL
);
