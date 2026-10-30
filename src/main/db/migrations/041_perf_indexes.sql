-- Big-database performance: the Sales report / dashboard filter by is_voided + created_at
-- (this index used to be created inside every Sales Report call).
CREATE INDEX IF NOT EXISTS idx_sales_voided_created ON sales(is_voided, created_at);
