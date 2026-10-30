-- Rule 12: Admin approval on the cashier screen. Every approval is logged
-- (what, bill, cashier, admin, when). Items sold with not enough stock go on a
-- "Stock to recount" list for the Admin.
CREATE TABLE IF NOT EXISTS approvals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,          -- comma list: discount_over_cap, sell_without_stock, change_old_bill, void_old_bill
    details     TEXT,
    sale_id     INTEGER REFERENCES sales(id),
    invoice_no  TEXT,
    cashier_id  INTEGER REFERENCES users(id),
    admin_id    INTEGER REFERENCES users(id),
    origin_pc   TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    uuid        TEXT
);
CREATE INDEX IF NOT EXISTS idx_approvals_created ON approvals(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_uuid ON approvals(uuid);
CREATE TRIGGER IF NOT EXISTS trg_approvals_ai AFTER INSERT ON approvals BEGIN
  UPDATE approvals SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('approvals', (SELECT uuid FROM approvals WHERE id = NEW.id), 'insert');
END;

CREATE TABLE IF NOT EXISTS stock_recount (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id  INTEGER NOT NULL REFERENCES product_variants(id),
    sale_id             INTEGER REFERENCES sales(id),
    reason              TEXT NOT NULL,   -- sold_without_stock
    note                TEXT,
    created_by          INTEGER REFERENCES users(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at         TEXT,
    resolved_by         INTEGER REFERENCES users(id),
    uuid                TEXT
);
CREATE INDEX IF NOT EXISTS idx_stock_recount_open ON stock_recount(resolved_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_recount_uuid ON stock_recount(uuid);
CREATE TRIGGER IF NOT EXISTS trg_stock_recount_ai AFTER INSERT ON stock_recount BEGIN
  UPDATE stock_recount SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('stock_recount', (SELECT uuid FROM stock_recount WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_stock_recount_au AFTER UPDATE ON stock_recount WHEN OLD.uuid IS NOT NULL BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('stock_recount', NEW.uuid, 'update');
END;
