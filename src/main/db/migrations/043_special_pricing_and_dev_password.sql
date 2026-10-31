-- 043_special_pricing_and_dev_password.sql
-- 1. Customer Special Pricing: custom fixed price, discount %, or margin % per product or pack size.
-- 2. Dev Panel password update.
-- 3. Setting for thermal printer font style ('monospace' | 'modern').

CREATE TABLE IF NOT EXISTS customer_special_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_unit_id INTEGER REFERENCES product_units(id) ON DELETE CASCADE,
  pricing_type TEXT NOT NULL CHECK(pricing_type IN ('fixed', 'discount_percent', 'margin_percent')),
  price REAL,
  percentage REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_special_prices_customer ON customer_special_prices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_special_prices_product ON customer_special_prices(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_special_prices_uuid ON customer_special_prices(uuid);

CREATE TRIGGER IF NOT EXISTS trg_customer_special_prices_ai AFTER INSERT ON customer_special_prices BEGIN
  UPDATE customer_special_prices SET uuid = lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(2))||'-'||hex(randomblob(6))) WHERE id = NEW.id AND uuid IS NULL;
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('customer_special_prices', (SELECT uuid FROM customer_special_prices WHERE id = NEW.id), 'insert');
END;

CREATE TRIGGER IF NOT EXISTS trg_customer_special_prices_au AFTER UPDATE ON customer_special_prices BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('customer_special_prices', NEW.uuid, 'update');
END;

CREATE TRIGGER IF NOT EXISTS trg_customer_special_prices_ad AFTER DELETE ON customer_special_prices BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('customer_special_prices', OLD.uuid, 'delete');
END;

-- Bake the new Dev Panel password
UPDATE dev_panel_config
SET password_hash = '$2b$10$YHoeMdI3Jj5BFRjbUZbKE.4iNPSsmc4uU0iKoKdmBNgfbw6r94YhK'
WHERE id = 1;

-- Default thermal printer font style
INSERT OR IGNORE INTO settings (key, value) VALUES ('thermal_font_style', 'monospace');
