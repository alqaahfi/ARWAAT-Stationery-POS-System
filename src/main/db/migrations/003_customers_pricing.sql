PRAGMA foreign_keys = ON;

-- Customer tiers, e.g. "Net Rate A", "Net Rate B" — used for net-rate pricing
CREATE TABLE IF NOT EXISTS customer_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Saved letterhead templates for A4 wholesale invoices
CREATE TABLE IF NOT EXISTS letterheads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    image_path TEXT NOT NULL,     -- path to the stored letterhead image/template file
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    name                   TEXT NOT NULL,
    customer_type          TEXT NOT NULL CHECK(customer_type IN ('retail','wholesale')),
    category_id            INTEGER REFERENCES customer_categories(id) ON DELETE SET NULL,
    assigned_letterhead_id INTEGER REFERENCES letterheads(id) ON DELETE SET NULL,
    phone                  TEXT,
    address                TEXT,
    opening_balance        REAL NOT NULL DEFAULT 0,   -- positive = customer owes the shop
    is_active              INTEGER NOT NULL DEFAULT 1,
    created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Net-rate pricing: an explicit price for a product unit, per customer category.
-- If no row exists here for a given (unit, category), fall back to the unit's default price.
CREATE TABLE IF NOT EXISTS product_category_prices (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    product_unit_id       INTEGER NOT NULL REFERENCES product_units(id) ON DELETE CASCADE,
    customer_category_id  INTEGER NOT NULL REFERENCES customer_categories(id) ON DELETE CASCADE,
    price                 REAL NOT NULL,
    UNIQUE(product_unit_id, customer_category_id)
);

-- Percentage-based selling for books/agency items: a margin % over cost_price,
-- set either for a specific customer OR a whole customer category (not both).
CREATE TABLE IF NOT EXISTS percentage_pricing_rules (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id            INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id           INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    customer_category_id  INTEGER REFERENCES customer_categories(id) ON DELETE CASCADE,
    percentage            REAL NOT NULL,
    CHECK (
        (customer_id IS NOT NULL AND customer_category_id IS NULL)
        OR (customer_id IS NULL AND customer_category_id IS NOT NULL)
    )
);
