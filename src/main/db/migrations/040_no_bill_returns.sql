-- Rule 17: a return without the bill (Admin only). It has no sale: sale_returns.sale_id
-- becomes nullable, and its line names the product Type + pack size directly
-- (sale_return_items.sale_item_id nullable + product_variant_id / product_unit_id).
-- SQLite can't drop NOT NULL in place, so both tables are rebuilt with their rows,
-- indexes and sync triggers (same shape as 026). Existing rows keep their uuids.
PRAGMA foreign_keys = OFF;

CREATE TABLE sale_returns_new (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    return_no           TEXT NOT NULL UNIQUE,
    sale_id             INTEGER REFERENCES sales(id),
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
INSERT INTO sale_returns_new (id, return_no, sale_id, customer_id, total_amount, cash_refund_amount, reason, note, restocked, created_by, origin_pc, created_at, uuid)
  SELECT id, return_no, sale_id, customer_id, total_amount, cash_refund_amount, reason, note, restocked, created_by, origin_pc, created_at, uuid FROM sale_returns;

CREATE TABLE sale_return_items_new (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id           INTEGER NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
    sale_item_id        INTEGER REFERENCES sale_items(id),
    product_variant_id  INTEGER REFERENCES product_variants(id),
    product_unit_id     INTEGER REFERENCES product_units(id),
    quantity            REAL NOT NULL,
    refund_amount       REAL NOT NULL,
    uuid                TEXT
);
INSERT INTO sale_return_items_new (id, return_id, sale_item_id, quantity, refund_amount, uuid)
  SELECT id, return_id, sale_item_id, quantity, refund_amount, uuid FROM sale_return_items;

DROP TABLE sale_return_items;
DROP TABLE sale_returns;
ALTER TABLE sale_returns_new RENAME TO sale_returns;
ALTER TABLE sale_return_items_new RENAME TO sale_return_items;

CREATE INDEX IF NOT EXISTS idx_sale_returns_sale ON sale_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_returns_customer ON sale_returns(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_returns_uuid ON sale_returns(uuid);
CREATE INDEX IF NOT EXISTS idx_sale_return_items_return_item ON sale_return_items(return_id, sale_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_return_items_uuid ON sale_return_items(uuid);

CREATE TRIGGER IF NOT EXISTS trg_sale_returns_ai AFTER INSERT ON sale_returns BEGIN
  UPDATE sale_returns SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sale_returns', (SELECT uuid FROM sale_returns WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_sale_return_items_ai AFTER INSERT ON sale_return_items BEGIN
  UPDATE sale_return_items SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sale_return_items', (SELECT uuid FROM sale_return_items WHERE id = NEW.id), 'insert');
END;

PRAGMA foreign_keys = ON;
