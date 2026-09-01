PRAGMA foreign_keys = ON;

-- Manual corrections to a customer/supplier balance that don't come from a
-- sale, purchase, or payment — e.g. writing off a bad debt, forgiving part of
-- a balance, or correcting an under-recorded charge. Positive amount
-- increases what the party owes (a debit); negative decreases it (a credit).
-- Included in the balance formula in ledger/balanceEngine.js.
CREATE TABLE IF NOT EXISTS ledger_adjustments (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    party_type   TEXT NOT NULL CHECK(party_type IN ('customer','supplier')),
    party_id     INTEGER NOT NULL,
    amount       REAL NOT NULL,
    reason       TEXT NOT NULL,
    created_by   INTEGER REFERENCES users(id),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ledger_adjustments_party ON ledger_adjustments(party_type, party_id);
