PRAGMA foreign_keys = ON;

ALTER TABLE product_variants ADD COLUMN barcode TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_barcode
  ON product_variants(barcode)
  WHERE barcode IS NOT NULL;
