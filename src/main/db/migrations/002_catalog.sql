PRAGMA foreign_keys = ON;

-- Product categories (Pens, Books, Notebooks, ...)
CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    contact_person  TEXT,
    phone           TEXT,
    address         TEXT,
    notes           TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A "product" is the general item, e.g. "Ball Pen" or "Physics Book Class 9"
CREATE TABLE IF NOT EXISTS products (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,
    sku                 TEXT UNIQUE,
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id         INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    base_unit_name      TEXT NOT NULL DEFAULT 'Piece',   -- the smallest unit stock is tracked in
    min_stock_alert     REAL NOT NULL DEFAULT 0,          -- low-stock threshold, in base_unit qty
    dead_stock_days     INTEGER,                          -- flag as dead stock if unsold this many days
    pricing_type        TEXT NOT NULL DEFAULT 'fixed' CHECK(pricing_type IN ('fixed','percentage')),
    default_percentage  REAL,                             -- default margin % (books / agency items)
    is_agency_item      INTEGER NOT NULL DEFAULT 0,
    notes               TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Variants of a product, e.g. Blue / Black for a Ball Pen. Every product gets
-- at least one variant row (name it 'Standard' if there's no real variation)
-- because stock is always tracked at the variant level.
CREATE TABLE IF NOT EXISTS product_variants (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_name      TEXT NOT NULL DEFAULT 'Standard',
    stock_qty         REAL NOT NULL DEFAULT 0,      -- always stored in base_unit terms
    last_purchased_at TEXT,
    last_sold_at      TEXT,
    date_added        TEXT NOT NULL DEFAULT (datetime('now')),
    is_active         INTEGER NOT NULL DEFAULT 1,
    UNIQUE(product_id, variant_name)
);

-- Selling units for a product, e.g. Piece / Box / Dozen, each with its own price
-- and a conversion factor back to the base unit (Piece = 1, Dozen = 12, Box = 10 ...).
CREATE TABLE IF NOT EXISTS product_units (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id           INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_name            TEXT NOT NULL,
    conversion_factor    REAL NOT NULL,
    retail_price         REAL NOT NULL DEFAULT 0,
    wholesale_price       REAL NOT NULL DEFAULT 0,
    cost_price           REAL NOT NULL DEFAULT 0,
    is_default_sale_unit INTEGER NOT NULL DEFAULT 0,
    UNIQUE(product_id, unit_name)
);

-- Full audit trail of every stock change (purchases, sales, returns, manual adjustments)
CREATE TABLE IF NOT EXISTS stock_movements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    product_variant_id  INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    movement_type       TEXT NOT NULL CHECK(movement_type IN ('purchase','sale','return_in','return_out','adjustment')),
    quantity            REAL NOT NULL,     -- base_unit terms; positive = stock in, negative = stock out
    reference_type      TEXT,
    reference_id        INTEGER,
    note                TEXT,
    created_by          INTEGER REFERENCES users(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
