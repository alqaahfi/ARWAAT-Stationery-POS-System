-- Purchases get the same extras a sale has: free-of-cost units per line (stock comes in, no money owed),
-- a bill-level discount, and the amount paid to the supplier when the purchase was saved.
ALTER TABLE purchase_items ADD COLUMN foc_quantity REAL NOT NULL DEFAULT 0;
ALTER TABLE purchases ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE purchases ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0;
