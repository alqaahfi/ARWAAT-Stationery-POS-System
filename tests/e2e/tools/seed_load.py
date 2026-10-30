import sqlite3, sys
# usage: seed_load.py <db>
db = sys.argv[1]
con = sqlite3.connect(db, timeout=30)
cur = con.cursor()
cat_row = cur.execute("SELECT id FROM categories LIMIT 1").fetchone()
cat_id = cat_row[0] if cat_row else None

cur.execute("BEGIN IMMEDIATE")
for i in range(1, 10001):
    bc = f"LD-{i:06d}"
    cur.execute(
        "INSERT INTO products (sku, name, category_id, base_unit_name, min_stock_alert, is_active) VALUES (?, ?, ?, 'Piece', 5, 1)",
        (f"SKU-LD-{i}", f"Load Test Stationery Item {i}", cat_id),
    )
    pid = cur.lastrowid
    cur.execute(
        "INSERT INTO product_variants (product_id, variant_name, barcode, stock_qty, is_active) VALUES (?, 'Standard', ?, 100, 1)",
        (pid, bc),
    )
    vid = cur.lastrowid
    cur.execute(
        "INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, note) VALUES (?, 'purchase', 100, 'initial_stock', 'Load seed')",
        (vid,),
    )
    cur.execute(
        "INSERT INTO product_units (product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, is_default_sale_unit, is_active) VALUES (?, 'Piece', 1, 50, 45, 30, 1, 1)",
        (pid,),
    )

for i in range(1, 2001):
    ph = f"0300{i:07d}"
    cur.execute(
        "INSERT INTO customers (name, customer_type, phone, mobile, opening_balance, credit_limit, joining_date, is_active) VALUES (?, 'retail', ?, ?, 0, 5000, '2026-01-01', 1)",
        (f"Load Customer {i}", ph, ph),
    )

sample = cur.execute(
    "SELECT pv.id, pv.product_id, pu.id FROM product_variants pv JOIN product_units pu ON pu.product_id = pv.product_id LIMIT 1"
).fetchone()
vid, pid, uid = sample[0], sample[1], sample[2]

for i in range(1, 50001):
    month = (i % 10) + 1
    day = (i % 28) + 1
    dt = f"2026-{month:02d}-{day:02d} 10:00:00"
    cur.execute(
        "INSERT INTO sales (invoice_no, customer_id, cashier_id, sale_type, subtotal, discount_amount, total_amount, paid_amount, balance_due, payment_status, created_at) VALUES (?, NULL, 1, 'retail', 100, 0, 100, 100, 0, 'paid', ?)",
        (f"INV-LD-{i:06d}", dt),
    )
    sid = cur.lastrowid
    cur.execute(
        "INSERT INTO sale_items (sale_id, product_id, product_variant_id, product_unit_id, quantity, foc_quantity, unit_price, discount_amount, line_total) VALUES (?, ?, ?, ?, 2, 0, 50, 0, 100)",
        (sid, pid, vid, uid),
    )

cur.execute("CREATE INDEX IF NOT EXISTS idx_sales_voided_created ON sales(is_voided, created_at)")
cur.execute("DELETE FROM sync_outbox")
con.commit()
con.execute("PRAGMA wal_checkpoint(PASSIVE)")
con.close()
print("OK")
