-- Extra customer details: second phone, email, a stored (not enforced) credit
-- limit, joining date (local YYYY-MM-DD) and free-text notes.
ALTER TABLE customers ADD COLUMN mobile TEXT;
ALTER TABLE customers ADD COLUMN email TEXT;
ALTER TABLE customers ADD COLUMN credit_limit REAL NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN joining_date TEXT;
ALTER TABLE customers ADD COLUMN notes TEXT;
