-- Rule 5: a voided bill is kept, not deleted. It stays in Sales History (red
-- "Voided" badge, reprints say VOIDED) but counts as zero everywhere: every
-- query that sums or lists money filters sales.is_voided = 0. The payments a
-- voided bill had are marked voided too (payments.is_voided = 1) so balances,
-- ledgers and payment lists skip them with the same simple filter.
ALTER TABLE sales ADD COLUMN is_voided INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN voided_at TEXT;
ALTER TABLE sales ADD COLUMN voided_by INTEGER REFERENCES users(id);
ALTER TABLE payments ADD COLUMN is_voided INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sales_is_voided ON sales(is_voided);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

-- Marking a payment voided is an UPDATE, which now has to reach other PCs
-- (payments are upsert + deletable since 030). Same guard as trg_sales_au: the
-- uuid back-fill done by trg_payments_ai right after an INSERT is not logged twice.
CREATE TRIGGER IF NOT EXISTS trg_payments_au AFTER UPDATE ON payments WHEN OLD.uuid IS NOT NULL BEGIN
  INSERT INTO sync_outbox (table_name, record_uuid, operation) VALUES ('payments', NEW.uuid, 'update');
END;
