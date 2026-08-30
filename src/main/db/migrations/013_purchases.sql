PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS purchases (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id    INTEGER NOT NULL REFERENCES suppliers(id),
    reference_no   TEXT,
    subtotal       REAL NOT NULL DEFAULT 0,
    total_amount   REAL NOT NULL DEFAULT 0,
    notes          TEXT,
    created_by     INTEGER REFERENCES users(id),
    purchase_date  TEXT NOT NULL DEFAULT (datetime('now')),
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id          INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id           INTEGER NOT NULL REFERENCES products(id),
    product_variant_id   INTEGER NOT NULL REFERENCES product_variants(id),
    quantity             REAL NOT NULL,
    unit_cost            REAL NOT NULL,
    line_total           REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
