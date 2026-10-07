-- Licensing is gone: no activation keys, no key pool, no hardware machine id.
-- The single-row table that used to be "license_activation" is really this PC's
-- setup record (role, shop name, station code, sync secret), so it is kept under
-- an honest name. ALTER TABLE ... RENAME also rewrites the origin_station
-- triggers from 022 that read it.
-- An existing install keeps its sync identity: the old machine_id becomes
-- settings('station_id'), so peers still recognise this PC. Fresh installs get a
-- random id from main/setup/stationIdentity.js.
INSERT OR IGNORE INTO settings (key, value)
  SELECT 'station_id', machine_id FROM license_activation WHERE id = 1;

ALTER TABLE license_activation RENAME TO station_config;
ALTER TABLE station_config DROP COLUMN license_key;
ALTER TABLE station_config DROP COLUMN machine_id;
ALTER TABLE station_config DROP COLUMN admin_host;
ALTER TABLE station_config RENAME COLUMN activated_at TO created_at;
DROP TABLE IF EXISTS license_keys;
