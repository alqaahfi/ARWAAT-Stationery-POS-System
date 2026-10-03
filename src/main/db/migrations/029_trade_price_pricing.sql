-- Trade Price pricing method for pack sizes. 'simple' = buying/retail/wholesale/C1-C5 typed by hand;
-- 'trade' = trade price + discounts typed, and the form derives cost/retail/wholesale/net_rate_c* from them
-- (so the price engine only ever reads the standard columns). Discounts are percentages except extra_discount (amount).
ALTER TABLE product_units ADD COLUMN pricing_method TEXT NOT NULL DEFAULT 'simple';
ALTER TABLE product_units ADD COLUMN trade_price REAL;
ALTER TABLE product_units ADD COLUMN purchase_discount REAL;
ALTER TABLE product_units ADD COLUMN extra_discount REAL;
ALTER TABLE product_units ADD COLUMN sale_discount_c1 REAL;
ALTER TABLE product_units ADD COLUMN sale_discount_c2 REAL;
ALTER TABLE product_units ADD COLUMN sale_discount_c3 REAL;
ALTER TABLE product_units ADD COLUMN sale_discount_c4 REAL;
ALTER TABLE product_units ADD COLUMN sale_discount_c5 REAL;
