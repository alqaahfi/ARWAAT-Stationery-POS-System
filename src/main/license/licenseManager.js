const crypto = require('crypto');
const { getDb } = require('../db/connection');
const { getMachineId } = require('./machineId');
const publicKey = require('./publicKey');

function verifyLicenseString(licenseKey, expectedMachineId) {
  try {
    const [payloadStr, signature] = licenseKey.split('.');
    if (!payloadStr || !signature) return { valid: false, reason: 'Malformed license key' };

    const isValidSig = crypto.verify(
      null,
      Buffer.from(payloadStr),
      publicKey,
      Buffer.from(signature, 'base64url')
    );
    if (!isValidSig) return { valid: false, reason: 'Invalid signature' };

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));

    if (payload.machineId !== expectedMachineId) {
      return { valid: false, reason: 'This license is not valid for this machine' };
    }
    if (payload.expiry && new Date(payload.expiry) < new Date()) {
      return { valid: false, reason: 'This license has expired' };
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: 'Could not read this license key' };
  }
}

function getActivationStatus() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM license_activation WHERE id = 1').get();
  if (!row) return { activated: false };

  if (row.role === 'admin') {
    const check = verifyLicenseString(row.license_key, row.machine_id);
    if (!check.valid) return { activated: false, reason: check.reason };
  }

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

function activateAdmin(licenseKey, shopName, stationCode) {
  const machineId = getMachineId();
  const check = verifyLicenseString(licenseKey, machineId);
  if (!check.valid) return { success: false, reason: check.reason };

  const syncSecret = generateSyncSecret();
  const db = getDb();
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
  ).run(machineId, shopName, licenseKey, stationCode || 'MAIN', syncSecret);

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