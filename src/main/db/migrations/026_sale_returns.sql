-- Customer returns / refunds (Phase 10B). A return belongs to one sale and
-- only that sale's lines; it is permanent (no edit/delete) and the original
-- sale row is never touched. Customer balances pick returns up through the
-- balance engine (total reduces what they owe, cash handed back adds back).

CREATE TABLE IF NOT EXISTS sale_returns (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    return_no           TEXT NOT NULL UNIQUE,
    sale_id             INTEGER NOT NULL REFERENCES sales(id),
    customer_id         INTEGER REFERENCES customers(id),
    total_amount        REAL NOT NULL,
    cash_refund_amount  REAL NOT NULL DEFAULT 0,
    reason              TEXT NOT NULL,
    note                TEXT,
    restocked           INTEGER NOT NULL DEFAULT 1,
    created_by          INTEGER REFERENCES users(id),
    origin_pc           TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    uuid                TEXT
);
CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_customer ON sale_returns(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_returns_uuid ON sale_returns(uuid);

CREATE TABLE IF NOT EXISTS sale_return_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id       INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    sale_item_id    INTEGER NOT NULL REFERENCES sale_items(id),
    quantity        REAL NOT NULL,
    refund_amount   REAL NOT NULL,
    uuid            TEXT
);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_return_item ON sale_return_items(return_id, sale_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_return_items_uuid ON sale_return_items(uuid);

-- Insert-only sync, same shape as trg_sales_ai / trg_sale_items_ai in
-- 022_sync_foundation.sql: fill a uuid if the app didn't, then log the outbox row.
CREATE TRIGGER IF NOT EXISTS trg_sale_returns_ai AFTER INSERT ON sale_returns BEGIN
  UPDATE sale_returns SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sale_returns', (SELECT uuid FROM sale_returns WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_sale_return_items_ai AFTER INSERT ON sale_return_items BEGIN
  UPDATE sale_return_items SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sale_return_items', (SELECT uuid FROM sale_return_items WHERE id = NEW.id), 'insert');
END;
