-- Hidden Roman-English search alias for a product. products.name now holds the
-- Urdu display name; search matches both. Synced via the generic column copy.
ALTER TABLE products ADD COLUMN search_alias TEXT;
