-- Extra supplier details: second phone, email and joining date (local YYYY-MM-DD).
ALTER TABLE suppliers ADD COLUMN mobile TEXT;
ALTER TABLE suppliers ADD COLUMN email TEXT;
ALTER TABLE suppliers ADD COLUMN joining_date TEXT;
