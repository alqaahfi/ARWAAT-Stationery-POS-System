PRAGMA foreign_keys = OFF;

-- The old push/pull dichotomy (006_sync.sql) doesn't fit the new combined
-- push-and-pull /sync/exchange protocol (022/023_sync_*.sql) — one call now
-- does both directions with one specific peer at once. Recreate sync_log
-- with a wider `direction` domain and columns identifying which peer, since
-- the Sync & PCs page needs to show "which peer, error if failed" per entry
-- and the old table had nothing to name a peer by.
ALTER TABLE sync_log RENAME TO sync_log_old;

CREATE TABLE sync_log (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    direction          TEXT NOT NULL CHECK(direction IN ('push','pull','exchange')),
    status             TEXT NOT NULL CHECK(status IN ('success','failed')),
    peer_machine_id    TEXT,
    peer_station_code  TEXT,
    message            TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO sync_log (id, direction, status, message, created_at)
  SELECT id, direction, status, message, created_at FROM sync_log_old;

DROP TABLE sync_log_old;

CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at);

PRAGMA foreign_keys = ON;
