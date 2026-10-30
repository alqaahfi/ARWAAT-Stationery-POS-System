-- Dev Panel: every install (fresh shop PC included) starts with a default password so the
-- panel can be opened; only the bcrypt HASH lives here, never the password. An existing
-- password (row already there) is left alone. Change it from Dev Panel -> Password.
INSERT OR IGNORE INTO dev_panel_config (id, password_hash)
VALUES (1, '$2b$10$QAw9YdOut5snMwfPbhr5puYx1UgfOLpffiQ.1kczItrDtTRIzhAd.');
