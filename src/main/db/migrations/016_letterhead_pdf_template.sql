PRAGMA foreign_keys = ON;

-- Letterheads are now a PDF page template (the admin's own pre-designed A4
-- page), merged with the invoice content at print time.
--
-- content_margin_top/bottom_mm control where the invoice content starts/ends
-- on the template page, so it doesn't collide with whatever the admin's own
-- letterhead artwork occupies at the top (and any footer/signature area at
-- the bottom) — tunable per letterhead since different templates need
-- different clearances.
ALTER TABLE letterheads ADD COLUMN pdf_template_path TEXT;
ALTER TABLE letterheads ADD COLUMN content_margin_top_mm REAL NOT NULL DEFAULT 40;
ALTER TABLE letterheads ADD COLUMN content_margin_bottom_mm REAL NOT NULL DEFAULT 25;
