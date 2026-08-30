PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_no      TEXT NOT NULL UNIQUE,
    sale_type       TEXT NOT NULL CHECK(sale_type IN ('retail','wholesale')),
    customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    cashier_id      INTEGER NOT NULL REFERENCES users(id),
    letterhead_id   INTEGER REFERENCES letterheads(id) ON DELETE SET NULL,
    subtotal        REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    tax_amount      REAL NOT NULL DEFAULT 0,
    total_amount    REAL NOT NULL DEFAULT 0,
    paid_amount     REAL NOT NULL DEFAULT 0,
    balance_due     REAL NOT NULL DEFAULT 0,
    payment_status  TEXT NOT NULL DEFAULT 'paid' CHECK(payment_status IN ('paid','partial','unpaid')),
    is_synced       INTEGER NOT NULL DEFAULT 0,   -- 0 until pushed from a Cashier PC to Admin
    origin_pc       TEXT,                          -- which PC created this sale
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id             INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id          INTEGER NOT NULL REFERENCES products(id),
    product_variant_id  INTEGER NOT NULL REFERENCES product_variants(id),
    product_unit_id     INTEGER NOT NULL REFERENCES product_units(id),
    quantity            REAL NOT NULL,        -- in the unit sold (e.g. 2 Boxes)
    unit_price          REAL NOT NULL,
    discount_amount     REAL NOT NULL DEFAULT 0,
    line_total          REAL NOT NULL
);
