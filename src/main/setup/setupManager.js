// First-run setup for this PC. There is nothing to buy, activate or register:
// the owner picks Admin or Cashier, fills one form, and is in.
//   Admin   -> shop name + owner login. The sync secret is generated here.
//   Cashier -> the sync secret from the Admin + a new cashier login. The Admin PC
//              is found on the LAN, checks the secret and creates the account;
//              only then is this PC marked as set up.
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { getDb } = require('../db/connection');
const { getStationId } = require('./stationIdentity');
const { getKnownPeers } = require('../sync/discovery');
const { DEFAULT_SYNC_PORT } = require('../sync/syncEngine');
const { createFirstAdmin, insertCashier, hasAdminUser, SALT_ROUNDS } = require('../ipc/users.ipc');

const ADMIN_STATION_CODE = 'MAIN';
const FIND_ADMIN_TIMEOUT_MS = 12000; // discovery broadcasts every 5s
const REGISTER_TIMEOUT_MS = 10000;
// A counter PC can make sales as soon as it joins; the Admin can trim this later
// from the Cashiers module like any other cashier.
const NEW_CASHIER_PERMISSIONS = ['make_sale', 'record_payment'];

function getConfig() {
  return getDb().prepare('SELECT * FROM station_config WHERE id = 1').get() || null;
}

function getSetupStatus() {
  const row = getConfig();
  // An Admin PC with a config row but no Admin account (setup interrupted by an
  // older build) is not finished — the setup screen simply runs again.
  const configured = Boolean(row) && (row.role === 'cashier' || hasAdminUser());
  if (!row) return { configured: false };
  return {
    configured,
    role: row.role,
    shopName: row.shop_name,
    stationCode: row.station_code,
    stationId: getStationId(),
    configuredAt: row.created_at,
  };
}

function generateSyncSecret() {
  return crypto.randomBytes(16).toString('hex');
}

function createAdminSetup({ shopName, fullName, username, password } = {}) {
  const db = getDb();
  if (getSetupStatus().configured) return { success: false, reason: 'This computer is already set up.' };
  if (!shopName || !shopName.trim()) return { success: false, reason: 'Please enter your shop name.' };

  const existing = getConfig();
  const syncSecret = (existing && existing.sync_secret) || generateSyncSecret();

  try {
    db.transaction(() => {
      const res = createFirstAdmin(fullName && fullName.trim(), username && username.trim(), password);
      if (!res.success) throw Object.assign(new Error(res.reason), { userFacing: true });
      db.prepare(
        `INSERT INTO station_config (id, shop_name, role, station_code, sync_secret)
         VALUES (1, ?, 'admin', ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           shop_name = excluded.shop_name, role = 'admin',
           station_code = excluded.station_code, sync_secret = excluded.sync_secret`
      ).run(shopName.trim(), ADMIN_STATION_CODE, syncSecret);
    })();
  } catch (err) {
    return { success: false, reason: err.userFacing ? err.message : 'Could not finish setup. Please try again.' };
  }
  getStationId();
  return { success: true };
}

// Admin side of a counter PC joining. Called by syncServer after it has checked
// the sync secret. `passwordHash` is already a bcrypt hash made on the counter PC.
function registerCashierAccount({ fullName, username, passwordHash } = {}) {
  const config = getConfig();
  if (!config || config.role !== 'admin') return { success: false, status: 403, reason: 'This computer is not the main computer.' };
  if (!fullName || !username || typeof passwordHash !== 'string' || !passwordHash.startsWith('$2')) {
    return { success: false, status: 400, reason: 'Name, username and password are required.' };
  }
  const db = getDb();
  const res = db.transaction(() => {
    const created = insertCashier(db, String(fullName).trim(), String(username).trim(), passwordHash);
    if (!created.success) return created;
    const grant = db.prepare('INSERT INTO user_permissions (user_id, permission_key, value) VALUES (?, ?, NULL)');
    for (const key of NEW_CASHIER_PERMISSIONS) grant.run(created.id, key);
    return created;
  })();
  if (!res.success) return { success: false, status: 409, reason: res.reason };
  return { success: true, shopName: config.shop_name };
}

async function findAdminPeer() {
  const deadline = Date.now() + FIND_ADMIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const peer = getKnownPeers().find((p) => p.role === 'admin' && p.online && p.ip);
    if (peer) return peer;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function joinAsCashier({ syncSecret, fullName, username, password } = {}) {
  if (getSetupStatus().configured) return { success: false, reason: 'This computer is already set up.' };
  const secret = (syncSecret || '').trim();
  if (!secret) return { success: false, reason: 'Please enter the Connection Code from the main computer.' };
  if (!fullName || !fullName.trim() || !username || !username.trim() || !password || password.length < 6) {
    return { success: false, reason: 'Full name, username and a password of at least 6 characters are required.' };
  }

  const admin = await findAdminPeer();
  if (!admin) {
    return { success: false, reason: "Couldn't find the main computer. Make sure it is turned on and on the same WiFi, then try again." };
  }

  const stationId = getStationId();
  const stationCode = 'C' + stationId.replace(/-/g, '').slice(0, 4).toUpperCase();
  let body;
  try {
    const res = await fetch(`http://${admin.ip}:${admin.tcpPort || DEFAULT_SYNC_PORT}/setup/register-cashier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': secret },
      body: JSON.stringify({
        fullName: fullName.trim(),
        username: username.trim(),
        passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
      }),
      signal: AbortSignal.timeout(REGISTER_TIMEOUT_MS),
    });
    if (res.status === 401) return { success: false, reason: "That Connection Code isn't right. Check it on the main computer and try again." };
    body = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, reason: body.reason || "The main computer couldn't create this account." };
  } catch {
    return { success: false, reason: "Couldn't reach the main computer. Check the WiFi and try again." };
  }

  getDb()
    .prepare(
      `INSERT INTO station_config (id, shop_name, role, station_code, sync_secret)
       VALUES (1, ?, 'cashier', ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         shop_name = excluded.shop_name, role = 'cashier',
         station_code = excluded.station_code, sync_secret = excluded.sync_secret`
    )
    .run(body.shopName || '', stationCode, secret);
  return { success: true };
}

module.exports = { getSetupStatus, createAdminSetup, joinAsCashier, registerCashierAccount };
