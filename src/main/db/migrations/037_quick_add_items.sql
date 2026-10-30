-- Rule 11: items the counter adds on the spot ("Add missing items at the
-- counter"). They are real products flagged needs_review until the Admin sets
-- the buying price etc. and approves them, or merges them into an existing
-- product (merged_into_product_id remembers where they went).
ALTER TABLE products ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN created_via TEXT;
ALTER TABLE products ADD COLUMN merged_into_product_id INTEGER REFERENCES products(id);
CREATE INDEX IF NOT EXISTS idx_products_needs_review ON products(needs_review);

-- A merge moves a quick-added item's sale lines onto the real product: those
-- are UPDATEs of sale_items, which now have to reach other PCs too.
CREATE TRIGGER IF NOT EXISTS trg_sale_items_au AFTER UPDATE ON sale_items WHEN OLD.uuid IS NOT NULL BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sale_items', NEW.uuid, 'update');
END;

-- The new permission is on by default for cashiers: existing cashiers who can
-- sell get it. Only on the Admin PC (permissions sync out from there), so two
-- PCs never create the same permission row twice.
INSERT OR IGNORE INTO user_permissions (user_id, permission_key, value)
  SELECT up.user_id, 'add_missing_items', NULL
  FROM user_permissions up JOIN users u ON u.id = up.user_id
  WHERE up.permission_key = 'make_sale' AND u.role = 'cashier'
    AND (SELECT role FROM station_config WHERE id = 1) = 'admin';
