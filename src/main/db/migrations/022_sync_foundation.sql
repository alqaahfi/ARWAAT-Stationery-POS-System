PRAGMA foreign_keys = OFF;

-- ============================================================================
-- PART 1: Global UUIDs on every table that can be written by more than one PC.
-- Local INTEGER PRIMARY KEY ids collide across PCs (two PCs can both create
-- "id 5") — uuid is what identifies a record across the whole shop's network.
--
-- The column is added with NO default here — SQLite refuses ALTER TABLE ADD
-- COLUMN with a non-constant default (randomblob() et al) on any table that
-- already has rows ("Cannot add a column with non-constant default"), and by
-- the time this migration runs on a real shop's database, these tables
-- almost certainly do. So: add the column bare, backfill existing rows with
-- one UPDATE per table (each row gets its own fresh value — the expression
-- is evaluated per row, not once for the whole statement), then let PART 3's
-- triggers generate one for every future INSERT that omits it. That trigger
-- is also why the app itself still never needs to generate these.
-- ============================================================================

ALTER TABLE products ADD COLUMN uuid TEXT;
UPDATE products SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_uuid ON products(uuid);

ALTER TABLE product_variants ADD COLUMN uuid TEXT;
UPDATE product_variants SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_uuid ON product_variants(uuid);

ALTER TABLE product_units ADD COLUMN uuid TEXT;
UPDATE product_units SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_units_uuid ON product_units(uuid);

ALTER TABLE categories ADD COLUMN uuid TEXT;
UPDATE categories SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_uuid ON categories(uuid);

ALTER TABLE customers ADD COLUMN uuid TEXT;
UPDATE customers SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_uuid ON customers(uuid);

ALTER TABLE suppliers ADD COLUMN uuid TEXT;
UPDATE suppliers SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_uuid ON suppliers(uuid);

ALTER TABLE users ADD COLUMN uuid TEXT;
UPDATE users SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uuid ON users(uuid);

ALTER TABLE user_permissions ADD COLUMN uuid TEXT;
UPDATE user_permissions SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_permissions_uuid ON user_permissions(uuid);

ALTER TABLE letterheads ADD COLUMN uuid TEXT;
UPDATE letterheads SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_letterheads_uuid ON letterheads(uuid);

ALTER TABLE percentage_pricing_rules ADD COLUMN uuid TEXT;
UPDATE percentage_pricing_rules SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_percentage_rules_uuid ON percentage_pricing_rules(uuid);

ALTER TABLE sales ADD COLUMN uuid TEXT;
UPDATE sales SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_uuid ON sales(uuid);

ALTER TABLE sale_items ADD COLUMN uuid TEXT;
UPDATE sale_items SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_items_uuid ON sale_items(uuid);

ALTER TABLE payments ADD COLUMN uuid TEXT;
UPDATE payments SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_uuid ON payments(uuid);

ALTER TABLE purchases ADD COLUMN uuid TEXT;
UPDATE purchases SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_uuid ON purchases(uuid);

ALTER TABLE purchase_items ADD COLUMN uuid TEXT;
UPDATE purchase_items SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_items_uuid ON purchase_items(uuid);

ALTER TABLE stock_movements ADD COLUMN uuid TEXT;
UPDATE stock_movements SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_uuid ON stock_movements(uuid);

ALTER TABLE ledger_adjustments ADD COLUMN uuid TEXT;
UPDATE ledger_adjustments SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE uuid IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_adjustments_uuid ON ledger_adjustments(uuid);

-- Also stamp master-data records with which station created them — useful
-- for debugging and shown in the Sync & PCs UI. (sales already carries an
-- origin_pc field from an earlier migration — no change needed there.)
ALTER TABLE products ADD COLUMN origin_station TEXT;
ALTER TABLE customers ADD COLUMN origin_station TEXT;
ALTER TABLE suppliers ADD COLUMN origin_station TEXT;

-- Same non-constant-default restriction applies here too, and station_code
-- lives in a different table anyway (a plain DEFAULT can't reference another
-- table even on an empty one) — stamped via an AFTER INSERT trigger instead.
-- This also fires the table's _au outbox trigger a second time for the same
-- row (insert, then this update), which is harmless for the same idempotency
-- reason called out below for product_variants.
CREATE TRIGGER IF NOT EXISTS trg_products_stamp_station AFTER INSERT ON products WHEN NEW.origin_station IS NULL BEGIN
  UPDATE products SET origin_station = (SELECT station_code FROM license_activation WHERE id = 1) WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_customers_stamp_station AFTER INSERT ON customers WHEN NEW.origin_station IS NULL BEGIN
  UPDATE customers SET origin_station = (SELECT station_code FROM license_activation WHERE id = 1) WHERE id = NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS trg_suppliers_stamp_station AFTER INSERT ON suppliers WHEN NEW.origin_station IS NULL BEGIN
  UPDATE suppliers SET origin_station = (SELECT station_code FROM license_activation WHERE id = 1) WHERE id = NEW.id;
END;

-- ============================================================================
-- PART 2: Outbox — every local write that needs to reach other PCs.
-- Populated automatically by triggers below, not by application code.
-- ============================================================================

DROP TABLE IF EXISTS sync_queue; -- superseded entirely by the trigger-driven outbox below

CREATE TABLE IF NOT EXISTS sync_outbox (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name    TEXT NOT NULL,
    record_uuid   TEXT NOT NULL,
    operation     TEXT NOT NULL CHECK(operation IN ('insert','update','delete')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_created ON sync_outbox(created_at);

-- Per-peer watermark: the highest sync_outbox.id we know a given peer has
-- already received from us, so each exchange only sends what's new.
-- last_received_outbox_id is the mirror of that in the other direction (how
-- far into THAT peer's own outbox we've already pulled) — without it, every
-- exchange would have to re-pull that peer's entire history to stay correct,
-- which defeats the "incremental, not full resends" goal above. Only ever
-- advanced once a round trip actually confirms the data moved (see
-- syncEngine.js) — safe to lag behind and resend a little (idempotent apply
-- everywhere absorbs that), never safe to advance on a guess.
CREATE TABLE IF NOT EXISTS sync_peer_state (
    peer_machine_id        TEXT PRIMARY KEY,
    peer_station_code      TEXT,
    peer_role              TEXT,
    last_known_ip          TEXT,
    last_seen_at           TEXT,
    last_synced_outbox_id  INTEGER NOT NULL DEFAULT 0,
    last_received_outbox_id INTEGER NOT NULL DEFAULT 0,
    last_sync_success_at   TEXT
);

-- ============================================================================
-- PART 2.5: Bootstrap the outbox for data that already existed before sync
-- did. PART 3's triggers only fire on writes from here on — anything created
-- earlier (this shop's existing products, customers, sales history, etc.)
-- would otherwise be invisible to sync forever, which would be silently
-- wrong the moment a Cashier PC is set up against a database that already
-- had real data in it (exactly the case on an existing installation, as
-- opposed to a brand new one where every one of these SELECTs is just empty).
-- ============================================================================

INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'products', uuid, 'insert' FROM products;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'product_variants', uuid, 'insert' FROM product_variants;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'product_units', uuid, 'insert' FROM product_units;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'categories', uuid, 'insert' FROM categories;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'customers', uuid, 'insert' FROM customers;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'suppliers', uuid, 'insert' FROM suppliers;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'users', uuid, 'insert' FROM users;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'user_permissions', uuid, 'insert' FROM user_permissions;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'letterheads', uuid, 'insert' FROM letterheads;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'percentage_pricing_rules', uuid, 'insert' FROM percentage_pricing_rules;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'sales', uuid, 'insert' FROM sales;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'sale_items', uuid, 'insert' FROM sale_items;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'payments', uuid, 'insert' FROM payments;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'purchases', uuid, 'insert' FROM purchases;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'purchase_items', uuid, 'insert' FROM purchase_items;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'stock_movements', uuid, 'insert' FROM stock_movements;
INSERT INTO sync_outbox (table_name, record_uuid, operation) SELECT 'ledger_adjustments', uuid, 'insert' FROM ledger_adjustments;

-- ============================================================================
-- PART 3: Triggers — populate sync_outbox automatically on every relevant
-- write. No application code changes needed for this part.
--
-- Every _ai (AFTER INSERT) trigger below does two things, in order: (1) if
-- the app inserted a row without a uuid (every current INSERT in this app
-- does, since the app was never meant to generate these itself), generate
-- one now — this is PART 1's DEFAULT expression, just moved here since it
-- can't live on the column itself; a row synced in from a peer already has
-- one, so this is a no-op for those. (2) log the outbox row, re-reading the
-- uuid rather than trusting NEW.uuid so it's always correct either way.
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_products_ai AFTER INSERT ON products BEGIN
  UPDATE products SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('products', (SELECT uuid FROM products WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_products_au AFTER UPDATE ON products BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('products', NEW.uuid, 'update');
END;

CREATE TRIGGER IF NOT EXISTS trg_product_variants_ai AFTER INSERT ON product_variants BEGIN
  UPDATE product_variants SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('product_variants', (SELECT uuid FROM product_variants WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_product_variants_au AFTER UPDATE ON product_variants BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('product_variants', NEW.uuid, 'update');
END;
-- NOTE: this update trigger also fires when stock_qty changes (e.g. from
-- applying a synced movement). This is fine — the sync layer must exclude
-- stock_qty from the payload it builds for product_variants updates (see
-- applyIncoming.js), since stock is only ever derived from stock_movements,
-- never sent/received as a raw value. Firing here just re-syncs the
-- non-stock fields, which is harmless and idempotent.

CREATE TRIGGER IF NOT EXISTS trg_product_units_ai AFTER INSERT ON product_units BEGIN
  UPDATE product_units SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('product_units', (SELECT uuid FROM product_units WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_product_units_au AFTER UPDATE ON product_units BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('product_units', NEW.uuid, 'update');
END;

CREATE TRIGGER IF NOT EXISTS trg_categories_ai AFTER INSERT ON categories BEGIN
  UPDATE categories SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('categories', (SELECT uuid FROM categories WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_categories_au AFTER UPDATE ON categories BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('categories', NEW.uuid, 'update');
END;

CREATE TRIGGER IF NOT EXISTS trg_customers_ai AFTER INSERT ON customers BEGIN
  UPDATE customers SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('customers', (SELECT uuid FROM customers WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_customers_au AFTER UPDATE ON customers BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('customers', NEW.uuid, 'update');
END;

CREATE TRIGGER IF NOT EXISTS trg_suppliers_ai AFTER INSERT ON suppliers BEGIN
  UPDATE suppliers SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('suppliers', (SELECT uuid FROM suppliers WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_suppliers_au AFTER UPDATE ON suppliers BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('suppliers', NEW.uuid, 'update');
END;

CREATE TRIGGER IF NOT EXISTS trg_users_ai AFTER INSERT ON users BEGIN
  UPDATE users SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('users', (SELECT uuid FROM users WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_users_au AFTER UPDATE ON users BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('users', NEW.uuid, 'update');
END;
-- NOTE: password_hash IS synced (a cashier must be able to log in locally on
-- their own PC). `sessions` is never synced (local-only, security-sensitive).

CREATE TRIGGER IF NOT EXISTS trg_user_permissions_ai AFTER INSERT ON user_permissions BEGIN
  UPDATE user_permissions SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('user_permissions', (SELECT uuid FROM user_permissions WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_user_permissions_au AFTER UPDATE ON user_permissions BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('user_permissions', NEW.uuid, 'update');
END;
CREATE TRIGGER IF NOT EXISTS trg_user_permissions_ad AFTER DELETE ON user_permissions BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('user_permissions', OLD.uuid, 'delete');
END;

CREATE TRIGGER IF NOT EXISTS trg_letterheads_ai AFTER INSERT ON letterheads BEGIN
  UPDATE letterheads SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('letterheads', (SELECT uuid FROM letterheads WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_letterheads_au AFTER UPDATE ON letterheads BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('letterheads', NEW.uuid, 'update');
END;
CREATE TRIGGER IF NOT EXISTS trg_letterheads_ad AFTER DELETE ON letterheads BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('letterheads', OLD.uuid, 'delete');
END;

CREATE TRIGGER IF NOT EXISTS trg_percentage_rules_ai AFTER INSERT ON percentage_pricing_rules BEGIN
  UPDATE percentage_pricing_rules SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('percentage_pricing_rules', (SELECT uuid FROM percentage_pricing_rules WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_percentage_rules_ad AFTER DELETE ON percentage_pricing_rules BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('percentage_pricing_rules', OLD.uuid, 'delete');
END;

CREATE TRIGGER IF NOT EXISTS trg_sales_ai AFTER INSERT ON sales BEGIN
  UPDATE sales SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sales', (SELECT uuid FROM sales WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_sale_items_ai AFTER INSERT ON sale_items BEGIN
  UPDATE sale_items SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sale_items', (SELECT uuid FROM sale_items WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_payments_ai AFTER INSERT ON payments BEGIN
  UPDATE payments SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('payments', (SELECT uuid FROM payments WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_purchases_ai AFTER INSERT ON purchases BEGIN
  UPDATE purchases SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('purchases', (SELECT uuid FROM purchases WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_purchase_items_ai AFTER INSERT ON purchase_items BEGIN
  UPDATE purchase_items SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('purchase_items', (SELECT uuid FROM purchase_items WHERE id = NEW.id), 'insert');
END;
CREATE TRIGGER IF NOT EXISTS trg_ledger_adjustments_ai AFTER INSERT ON ledger_adjustments BEGIN
  UPDATE ledger_adjustments SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('ledger_adjustments', (SELECT uuid FROM ledger_adjustments WHERE id = NEW.id), 'insert');
END;

-- Stock movements: insert only, handled specially by the sync engine
-- (delta-replay, not generic upsert) — still logged the same way here.
CREATE TRIGGER IF NOT EXISTS trg_stock_movements_ai AFTER INSERT ON stock_movements BEGIN
  UPDATE stock_movements SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('stock_movements', (SELECT uuid FROM stock_movements WHERE id = NEW.id), 'insert');
END;

PRAGMA foreign_keys = ON;
