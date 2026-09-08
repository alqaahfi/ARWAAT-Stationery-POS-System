PRAGMA foreign_keys = ON;

-- Shared secret required on every sync exchange between PCs. Generated once
-- on the Admin PC during Setup Admin, then manually entered on each Cashier
-- PC during Setup Cashier (the admin reads it off their own screen and types
-- it in) — this is the access-control boundary now that PCs connect over a
-- WiFi router rather than a closed wired network.
ALTER TABLE license_activation ADD COLUMN sync_secret TEXT;
