-- The original letterheads table (migration 003) declared image_path
-- NOT NULL, back when every letterhead was an uploaded image. Letterheads
-- are now a PDF template (pdf_template_path) instead, and nothing writes
-- image_path anymore — but SQLite can't ALTER a column to drop NOT NULL in
-- place, so every insert has been failing that constraint. Rebuild the
-- table (SQLite's documented pattern for this kind of schema change),
-- preserving existing rows/ids so the FKs from customers.assigned_letterhead_id
-- and sales.letterhead_id keep pointing at the same rows.
PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE letterheads_new (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    name                      TEXT NOT NULL,
    image_path                TEXT,
    pdf_template_path         TEXT,
    content_margin_top_mm     REAL NOT NULL DEFAULT 40,
    content_margin_bottom_mm  REAL NOT NULL DEFAULT 25,
    is_default                INTEGER NOT NULL DEFAULT 0,
    created_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO letterheads_new (id, name, image_path, pdf_template_path, content_margin_top_mm, content_margin_bottom_mm, is_default, created_at)
SELECT id, name, image_path, pdf_template_path, content_margin_top_mm, content_margin_bottom_mm, is_default, created_at
FROM letterheads;

DROP TABLE letterheads;
ALTER TABLE letterheads_new RENAME TO letterheads;

COMMIT;

PRAGMA foreign_keys = ON;
