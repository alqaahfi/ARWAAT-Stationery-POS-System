const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { PERMISSION_DEFINITIONS } = require('../../shared/permissionDefinitions');

const SALT_ROUNDS = 12;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function toPublicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
  };
}

function hasAnyUser() {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  return row.count > 0;
}

function createFirstAdmin(fullName, username, password) {
  const db = getDb();

  if (hasAnyUser()) {
    return { success: false, reason: 'Setup has already been completed on this PC.' };
  }
  if (!fullName || !username || !password || password.length < 6) {
    return { success: false, reason: 'Full name, username and a password of at least 6 characters are required.' };
  }

  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

  try {
    const result = db
      .prepare(
        `INSERT INTO users (full_name, username, password_hash, role)
         VALUES (?, ?, ?, 'admin')`
      )
      .run(fullName, username, passwordHash);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    return { success: true, user: toPublicUser(user) };
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE/.test(err.message)) {
      return { success: false, reason: 'That username is already taken.' };
    }
    return { success: false, reason: 'Could not create admin account.' };
  }
}

function login(username, password) {
  const db = getDb();

  if (!username || !password) {
    return { success: false, reason: 'Username and password are required.' };
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !user.is_active) {
    return { success: false, reason: 'Invalid username or password.' };
  }

  const passwordOk = bcrypt.compareSync(password, user.password_hash);
  if (!passwordOk) {
    return { success: false, reason: 'Invalid username or password.' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  db.prepare(
    `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`
  ).run(user.id, token, expiresAt);

  return { success: true, token, user: toPublicUser(user) };
}

function validateSession(token) {
  const db = getDb();
  if (!token) return { valid: false };

  const session = db
    .prepare('SELECT * FROM sessions WHERE token = ? AND is_revoked = 0')
    .get(token);

  if (!session) return { valid: false };
  if (new Date(session.expires_at) < new Date()) return { valid: false };

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!user || !user.is_active) return { valid: false };

  return { valid: true, user: toPublicUser(user) };
}

function logout(token) {
  const db = getDb();
  if (token) {
    db.prepare('UPDATE sessions SET is_revoked = 1 WHERE token = ?').run(token);
  }
  return { success: true };
}

// permission_key existing = granted. `value` is only meaningful for keys that
// carry a setting (e.g. max_discount_percentage) — plain boolean flags store
// value = NULL, surfaced here as `true` so the caller can just check truthiness.
function getPermissions(userId) {
  const db = getDb();
  const rows = db.prepare('SELECT permission_key, value FROM user_permissions WHERE user_id = ?').all(userId);
  const map = {};
  for (const row of rows) {
    map[row.permission_key] = row.value === null || row.value === '' ? true : row.value;
  }
  return map;
}

// Dev/testing convenience: makes sure a demo cashier account always exists so the
// cashier side of the login flow can be exercised without building an "Add Cashier"
// admin screen yet. Safe to call on every startup — it's a no-op once the account exists.
// Granted make_sale (+ a sample discount cap) so the seeded account can actually
// reach the POS screen under the fail-safe permission model, not just log in.
function seedDummyCashier() {
  const db = getDb();
  let cashier = db.prepare('SELECT id FROM users WHERE username = ?').get('cashier');

  if (!cashier) {
    const passwordHash = bcrypt.hashSync('cashier123', SALT_ROUNDS);
    const result = db
      .prepare(
        `INSERT INTO users (full_name, username, password_hash, role)
         VALUES ('Cashier (Demo)', 'cashier', ?, 'cashier')`
      )
      .run(passwordHash);
    cashier = { id: result.lastInsertRowid };

    const grant = db.prepare('INSERT INTO user_permissions (user_id, permission_key, value) VALUES (?, ?, ?)');
    grant.run(cashier.id, 'make_sale', null);
    grant.run(cashier.id, 'max_discount_percentage', '10');
  }

  // record_payment ships granted-by-default for cashiers (revocable later from
  // Users & Permissions) — backfilled here too, so a cashier account created
  // before this permission existed still ends up with it.
  const hasRecordPayment = db
    .prepare('SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_key = ?')
    .get(cashier.id, 'record_payment');
  if (!hasRecordPayment) {
    db.prepare('INSERT INTO user_permissions (user_id, permission_key, value) VALUES (?, ?, NULL)').run(cashier.id, 'record_payment');
  }
}

// ---------------- Users & Permissions module (admin-only) ----------------
// Every write below also enqueues a sync_queue entry — admin-outbound master
// data (the opposite direction of the POS module's cashier-outbound sales
// queuing) so a future Sync engine can pull it down to Cashier PCs, letting
// them authenticate a cashier locally even while offline.

function snapshotUser(db, userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

function queueUserSync(db, userId, operation) {
  const row = snapshotUser(db, userId);
  db.prepare(`INSERT INTO sync_queue (table_name, record_id, operation, payload) VALUES ('users', ?, ?, ?)`).run(
    userId,
    operation,
    JSON.stringify(row)
  );
}

function queuePermissionSync(db, recordId, operation, payload) {
  db.prepare(`INSERT INTO sync_queue (table_name, record_id, operation, payload) VALUES ('user_permissions', ?, ?, ?)`).run(
    recordId,
    operation,
    JSON.stringify(payload)
  );
}

function list() {
  const db = getDb();
  // Admin row first (there's only ever one), then cashiers by name.
  return db
    .prepare(
      `SELECT id, full_name, username, role, is_active, created_at
       FROM users
       ORDER BY (role != 'admin'), full_name`
    )
    .all();
}

function checkUsernameUnique({ username, excludeUserId }) {
  const db = getDb();
  if (!username || !username.trim()) return { unique: false };
  const row = excludeUserId
    ? db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username.trim(), excludeUserId)
    : db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  return { unique: !row };
}

// role is hardcoded 'cashier' in the INSERT below and is never accepted as a
// parameter — this module must never be able to create a second admin.
function createCashier({ fullName, username, password }) {
  const db = getDb();
  if (!fullName || !fullName.trim()) return { success: false, reason: 'Full name is required.' };
  if (!username || !username.trim()) return { success: false, reason: 'Username is required.' };
  if (!password || password.length < 6) return { success: false, reason: 'Password must be at least 6 characters.' };

  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

  try {
    const result = db
      .prepare(`INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, 'cashier')`)
      .run(fullName.trim(), username.trim(), passwordHash);

    queueUserSync(db, result.lastInsertRowid, 'insert');
    return { success: true, id: result.lastInsertRowid };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'That username is already taken.' };
    return { success: false, reason: 'Could not create cashier account.' };
  }
}

// Full Name only — username is fixed after creation, and password changes go
// through resetPassword() so they're never accidentally cleared here.
function updateUser({ id, fullName }) {
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return { success: false, reason: 'User not found.' };
  if (target.role === 'admin') return { success: false, reason: 'The admin account cannot be edited from this module.' };
  if (!fullName || !fullName.trim()) return { success: false, reason: 'Full name is required.' };

  db.prepare(`UPDATE users SET full_name = ?, updated_at = datetime('now') WHERE id = ?`).run(fullName.trim(), id);
  queueUserSync(db, id, 'update');
  return { success: true };
}

// Deactivating logs the cashier out immediately, everywhere — not just a
// block on future logins.
function setActive({ id, isActive }) {
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return { success: false, reason: 'User not found.' };
  if (target.role === 'admin') return { success: false, reason: 'The admin account cannot be deactivated.' };

  db.prepare(`UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).run(isActive ? 1 : 0, id);
  if (!isActive) {
    db.prepare('UPDATE sessions SET is_revoked = 1 WHERE user_id = ?').run(id);
  }
  queueUserSync(db, id, 'update');
  return { success: true };
}

function resetPassword({ id, newPassword }) {
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return { success: false, reason: 'User not found.' };
  if (target.role === 'admin') return { success: false, reason: 'The admin account cannot be reset from this module.' };
  if (!newPassword || newPassword.length < 6) return { success: false, reason: 'Password must be at least 6 characters.' };

  const passwordHash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(passwordHash, id);
  db.prepare('UPDATE sessions SET is_revoked = 1 WHERE user_id = ?').run(id);
  queueUserSync(db, id, 'update');
  return { success: true };
}

// Resolves the saved values for one user against the permission catalog —
// booleans as true/false (row exists or not), numbers as the stored string
// value or '' when unset (meaning "falls back to the shop default").
function getPermissionsForUser(userId) {
  const db = getDb();
  const rows = db.prepare('SELECT permission_key, value FROM user_permissions WHERE user_id = ?').all(userId);
  const stored = {};
  for (const row of rows) stored[row.permission_key] = row.value;

  const resolved = {};
  for (const def of PERMISSION_DEFINITIONS) {
    const has = Object.prototype.hasOwnProperty.call(stored, def.key);
    resolved[def.key] = def.type === 'boolean' ? has : has ? stored[def.key] : '';
  }
  return resolved;
}

// Reconciles user_permissions rows for one user against the full submitted
// value set, one definition at a time, all inside a single transaction.
function savePermissionsForUser({ userId, values }) {
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!target) return { success: false, reason: 'User not found.' };

  const run = db.transaction(() => {
    for (const def of PERMISSION_DEFINITIONS) {
      const key = def.key;
      const provided = values ? values[key] : undefined;
      const existing = db.prepare('SELECT * FROM user_permissions WHERE user_id = ? AND permission_key = ?').get(userId, key);

      if (def.type === 'boolean') {
        const shouldHave = !!provided;
        if (shouldHave && !existing) {
          const result = db
            .prepare('INSERT INTO user_permissions (user_id, permission_key, value) VALUES (?, ?, NULL)')
            .run(userId, key);
          queuePermissionSync(db, result.lastInsertRowid, 'insert', { user_id: userId, permission_key: key, value: null });
        } else if (!shouldHave && existing) {
          db.prepare('DELETE FROM user_permissions WHERE id = ?').run(existing.id);
          queuePermissionSync(db, existing.id, 'delete', { id: existing.id, user_id: userId, permission_key: key });
        }
      } else {
        const hasValue = provided !== undefined && provided !== null && provided !== '';
        if (hasValue && existing) {
          db.prepare('UPDATE user_permissions SET value = ? WHERE id = ?').run(String(provided), existing.id);
          queuePermissionSync(db, existing.id, 'update', { id: existing.id, user_id: userId, permission_key: key, value: String(provided) });
        } else if (hasValue && !existing) {
          const result = db
            .prepare('INSERT INTO user_permissions (user_id, permission_key, value) VALUES (?, ?, ?)')
            .run(userId, key, String(provided));
          queuePermissionSync(db, result.lastInsertRowid, 'insert', { user_id: userId, permission_key: key, value: String(provided) });
        } else if (!hasValue && existing) {
          db.prepare('DELETE FROM user_permissions WHERE id = ?').run(existing.id);
          queuePermissionSync(db, existing.id, 'delete', { id: existing.id, user_id: userId, permission_key: key });
        }
      }
    }
  });

  run();
  return { success: true };
}

function registerUsersIpc() {
  ipcMain.handle('users:has-any-user', () => hasAnyUser());

  ipcMain.handle('users:create-first-admin', (event, { fullName, username, password } = {}) =>
    createFirstAdmin(fullName, username, password)
  );

  ipcMain.handle('users:login', (event, { username, password } = {}) => login(username, password));

  ipcMain.handle('users:validate-session', (event, { token } = {}) => validateSession(token));

  ipcMain.handle('users:logout', (event, { token } = {}) => logout(token));

  ipcMain.handle('users:get-permissions', (event, { userId } = {}) => getPermissions(userId));

  ipcMain.handle('users:list', () => list());
  ipcMain.handle('users:create-cashier', (event, payload) => createCashier(payload || {}));
  ipcMain.handle('users:update', (event, payload) => updateUser(payload || {}));
  ipcMain.handle('users:check-username-unique', (event, payload) => checkUsernameUnique(payload || {}));
  ipcMain.handle('users:reset-password', (event, payload) => resetPassword(payload || {}));
  ipcMain.handle('users:set-active', (event, payload) => setActive(payload || {}));

  ipcMain.handle('permissions:get-definitions', () => PERMISSION_DEFINITIONS);
  ipcMain.handle('permissions:get-for-user', (event, { userId } = {}) => getPermissionsForUser(userId));
  ipcMain.handle('permissions:save-for-user', (event, payload) => savePermissionsForUser(payload || {}));
}

module.exports = { registerUsersIpc, seedDummyCashier };
