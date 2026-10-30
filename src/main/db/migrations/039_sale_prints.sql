-- Rule 14: the first print of a bill after saving is the original; every later
-- print says DUPLICATE COPY with the reprint date/time. Each successful print is
-- recorded here (insert-only, synced, so a reprint on any PC is a duplicate).
CREATE TABLE IF NOT EXISTS sale_prints (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id     INTEGER NOT NULL REFERENCES sales(id),
    copy        TEXT NOT NULL,           -- 'original' | 'duplicate'
    print_type  TEXT,                    -- 'retail-thermal' | 'wholesale-a4'
    printed_by  INTEGER REFERENCES users(id),
    printed_at  TEXT NOT NULL DEFAULT (datetime('now')),
    uuid        TEXT
);
CREATE INDEX IF NOT EXISTS idx_sale_prints_sale ON sale_prints(sale_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_prints_uuid ON sale_prints(uuid);
CREATE TRIGGER IF NOT EXISTS trg_sale_prints_ai AFTER INSERT ON sale_prints BEGIN
  UPDATE sale_prints SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sale_prints', (SELECT uuid FROM sale_prints WHERE id = NEW.id), 'insert');
END;
