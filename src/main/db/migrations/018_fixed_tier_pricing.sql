PRAGMA foreign_keys = OFF;

-- Replaces the admin-managed Customer Categories (Net Rate) system with a
-- fixed 5-tier structure: every customer is assigned one of exactly 5 tiers
-- (C1-C5) or none, and every product unit carries an optional hardcoded net
-- rate per tier. This is a breaking change — any existing customer-category
-- assignments and category-level price overrides are dropped, not migrated
-- (there's no way to map an arbitrary old category name to a fixed tier).

DROP TABLE IF EXISTS product_category_prices;
DROP TABLE IF EXISTS customer_categories;

-- idx_customers_category (007_indexes.sql) indexes the column being dropped —
-- SQLite's DROP COLUMN doesn't drop dependent indexes on its own. (No need to
-- drop idx_category_prices_lookup separately — it indexed product_category_prices,
-- and DROP TABLE above already took it with the table.)
DROP INDEX IF EXISTS idx_customers_category;

ALTER TABLE customers DROP COLUMN category_id;
ALTER TABLE customers ADD COLUMN tier TEXT;

ALTER TABLE product_units ADD COLUMN net_rate_c1 REAL;
ALTER TABLE product_units ADD COLUMN net_rate_c2 REAL;
ALTER TABLE product_units ADD COLUMN net_rate_c3 REAL;
ALTER TABLE product_units ADD COLUMN net_rate_c4 REAL;
ALTER TABLE product_units ADD COLUMN net_rate_c5 REAL;

-- Rebuild percentage_pricing_rules with customer_tier in place of
-- customer_category_id. Per-customer rules (customer_id IS NOT NULL) carry
-- over as-is; per-category rules are dropped along with the categories table
-- they pointed at.
CREATE TABLE percentage_pricing_rules_new (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id    INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    customer_tier  TEXT,
    percentage     REAL NOT NULL,
    CHECK (
        (customer_id IS NOT NULL AND customer_tier IS NULL)
        OR (customer_id IS NULL AND customer_tier IS NOT NULL)
    )
);

INSERT INTO percentage_pricing_rules_new (id, product_id, customer_id, customer_tier, percentage)
SELECT id, product_id, customer_id, NULL, percentage
FROM percentage_pricing_rules
WHERE customer_id IS NOT NULL;

DROP TABLE percentage_pricing_rules;
ALTER TABLE percentage_pricing_rules_new RENAME TO percentage_pricing_rules;

CREATE INDEX IF NOT EXISTS idx_percentage_rules_product ON percentage_pricing_rules(product_id);

PRAGMA foreign_keys = ON;
