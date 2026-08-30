PRAGMA foreign_keys = ON;

-- Every offline write on a Cashier PC gets queued here; a background worker
-- pushes rows to the Admin PC's API when it's reachable.
CREATE TABLE IF NOT EXISTS sync_queue (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id  INTEGER NOT NULL,
    operation  TEXT NOT NULL CHECK(operation IN ('insert','update','delete')),
    payload    TEXT NOT NULL,     -- JSON snapshot of the row
    is_synced  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    synced_at  TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    direction  TEXT NOT NULL CHECK(direction IN ('push','pull')),
    status     TEXT NOT NULL CHECK(status IN ('success','failed')),
    message    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
