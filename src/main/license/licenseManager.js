const crypto = require('crypto');
const { getDb } = require('../db/connection');
const { getMachineId } = require('./machineId');

function getActivationStatus() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM license_activation WHERE id = 1').get();
  if (!row) return { activated: false };

  return {
    activated: true,
    role: row.role,
    shopName: row.shop_name,
    adminHost: row.admin_host,
    machineId: row.machine_id,
    activatedAt: row.activated_at,
    stationCode: row.station_code,
  };
}

// The shared secret every /sync/exchange call must present (023_sync_secret.sql).
// Generated once, here, on the Admin PC right after activation succeeds —
// SetupAdmin.jsx displays it for the admin to copy and hand-enter on each
// Cashier PC during its own setup (activateCashier below).
function generateSyncSecret() {
  return crypto.randomBytes(16).toString('hex');
}

// Forgiving of case and stray whitespace on entry — "abc12-..." or " ABC12 - ... "
// should still match the exact pool value stored in license_keys.
function normalizeKeyValue(keyValue) {
  return (keyValue || '').replace(/\s+/g, '').toUpperCase();
}

// Activation against the fixed pool of 500 pre-generated keys baked into the
// app by 025_license_keys.sql (plain local lookup, not a cryptographic
// signature). Enforcement is per-installation only: consuming a key here
// marks it used in THIS PC's own database, but a different installation has
// its own identical copy of the same table and would independently accept
// the same key value — see the migration file's header comment. Preventing
// that is on the developer, not this code.
function activateAdmin(keyValue, shopName, stationCode) {
  const normalized = normalizeKeyValue(keyValue);
  const db = getDb();

  const keyRow = db.prepare('SELECT * FROM license_keys WHERE key_value = ? AND is_used = 0').get(normalized);
  if (!keyRow) {
    return { success: false, reason: 'Invalid or already-used activation key.' };
  }

  const machineId = getMachineId();
  const syncSecret = generateSyncSecret();

  const activate = db.transaction(() => {
    db.prepare(`UPDATE license_keys SET is_used = 1, used_at = datetime('now') WHERE id = ?`).run(keyRow.id);
    db.prepare(
      `INSERT INTO license_activation (id, machine_id, shop_name, license_key, role, admin_host, station_code, sync_secret)
       VALUES (1, ?, ?, ?, 'admin', NULL, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         machine_id = excluded.machine_id,
         shop_name = excluded.shop_name,
         license_key = excluded.license_key,
         role = excluded.role,
         station_code = excluded.station_code,
         sync_secret = excluded.sync_secret`
    ).run(machineId, shopName || '', normalized, stationCode || 'MAIN', syncSecret);
  });
  activate();

  return { success: true, syncSecret };
}

function activateCashier(adminHost, stationCode, syncSecret) {
  const machineId = getMachineId();
  const db = getDb();
  db.prepare(
    `INSERT INTO license_activation (id, machine_id, shop_name, license_key, role, admin_host, station_code, sync_secret)
     VALUES (1, ?, '', 'CASHIER-NO-KEY', 'cashier', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       machine_id = excluded.machine_id,
       role = excluded.role,
       admin_host = excluded.admin_host,
       station_code = excluded.station_code,
       sync_secret = excluded.sync_secret`
  ).run(machineId, adminHost || null, stationCode || 'C1', syncSecret);

  return { success: true };
}

module.exports = { getMachineId, getActivationStatus, activateAdmin, activateCashier };
