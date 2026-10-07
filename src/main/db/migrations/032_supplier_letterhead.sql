-- Optional letterhead for a supplier's purchase receipts (NULL = shop default).
ALTER TABLE suppliers ADD COLUMN assigned_letterhead_id INTEGER REFERENCES letterheads(id);
