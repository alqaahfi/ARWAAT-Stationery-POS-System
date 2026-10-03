-- Free-of-cost (bonus) quantity per sale line, in the same unit as quantity. Not charged, not discounted,
-- but stock is deducted for quantity + foc_quantity.
ALTER TABLE sale_items ADD COLUMN foc_quantity REAL NOT NULL DEFAULT 0;

-- Bills can now be edited or voided after the fact, so sales, sale_items and payments are no longer immutable.
-- Update/delete triggers feed the sync outbox (syncSchema.js moves these tables to upsert + deletable).
CREATE TRIGGER IF NOT EXISTS trg_sales_au AFTER UPDATE ON sales WHEN OLD.uuid IS NOT NULL BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sales', NEW.uuid, 'update');
END;
CREATE TRIGGER IF NOT EXISTS trg_sales_ad AFTER DELETE ON sales BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sales', OLD.uuid, 'delete');
END;
CREATE TRIGGER IF NOT EXISTS trg_sale_items_ad AFTER DELETE ON sale_items BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('sale_items', OLD.uuid, 'delete');
END;
CREATE TRIGGER IF NOT EXISTS trg_payments_ad AFTER DELETE ON payments BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('payments', OLD.uuid, 'delete');
END;
