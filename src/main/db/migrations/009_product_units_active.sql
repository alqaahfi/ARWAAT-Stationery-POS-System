PRAGMA foreign_keys = ON;

-- The Products module soft-deletes a unit row that's removed from a product's
-- form (rather than hard-deleting it, since sale_items may reference it) —
-- product_variants already has is_active for the same reason; product_units
-- was missing it.
ALTER TABLE product_units ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
