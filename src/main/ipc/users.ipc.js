const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { PERMISSION_DEFINITIONS } = require('../../shared/permissionDefinitions');
const { logActivity } = require('../activity/activityLog');
const sessions = require('../devpanel/sessionTracker');
const { getCaller } = require('../security/ipcGuard');
const { getModeForWebContents } = require('../windows');

const SALT_ROUNDS = 12;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Wrong-password lockout, kept in memory: 5 misses for one username (or one
// user's lock screen) refuses it for 5 minutes. A correct password resets it.
const MAX_WRONG_TRIES = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const TOO_MANY_TRIES = 'Too many wrong tries. Try again in 5 minutes.';
const wrongTries = new Map(); // key -> { count, lockedUntil }

function isLockedOut(key) {
  const entry = wrongTries.get(key);
  return !!entry && entry.lockedUntil > Date.now();
}

function recordWrongTry(key) {
  const entry = wrongTries.get(key) || { count: 0, lockedUntil: 0 };
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
    entry.count = 0;
    entry.lockedUntil = 0;
  }
  entry.count += 1;
  if (entry.count >= MAX_WRONG_TRIES) entry.lockedUntil = Date.now() + LOCKOUT_MS;
  wrongTries.set(key, entry);
}

const ADMIN_LOGIN_ONLY = 'This is the Admin login. Cashiers sign in from the ARWAAT Cashier shortcut.';
const CASHIER_LOGIN_ONLY = 'This is the Cashier login. Use the ARWAAT Admin shortcut to manage the shop.';
const COUNTER_PC = 'This is a counter computer. The Admin app runs on the main computer.';

function stationRole() {
  const row = getDb().prepare('SELECT role FROM station_config WHERE id = 1').get();
  return row ? row.role : null;
}

// Which accounts a window may sign in: the Admin window takes the Admin only
// (and nobody on a counter PC); the Cashier window takes cashiers only.
function roleRefusal(mode, userRole) {
  if (mode === 'cashier') return userRole === 'admin' ? CASHIER_LOGIN_ONLY : null;
  if (stationRole() === 'cashier') return COUNTER_PC;
  return userRole === 'admin' ? null : ADMIN_LOGIN_ONLY;
}

function toPublicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
  };
}

// Specifically "is there an admin account yet" — NOT "is there any user".
// In development seedDummyCashier() below inserts a demo cashier on every boot,
// before Setup ever runs, so any-user can be true on a fresh dev install too.
function hasAdminUser() {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get();
  return row.count > 0;
}

function createFirstAdmin(fullName, username, password) {
  const db = getDb();

  if (hasAdminUser()) {
    return { success: false, reason: 'This shop already has an Admin.' };
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

function login(username, password, mode) {
  const db = getDb();

  if (!username || !password) {
    return { success: false, reason: 'Username and password are required.' };
  }

  const lockKey = `login:${String(username).toLowerCase()}`;
  if (isLockedOut(lockKey)) return { success: false, reason: TOO_MANY_TRIES };

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !user.is_active || !bcrypt.compareSync(password, user.password_hash)) {
    recordWrongTry(lockKey);
    return { success: false, reason: isLockedOut(lockKey) ? TOO_MANY_TRIES : 'Invalid username or password.' };
  }
  wrongTries.delete(lockKey);

  // Checked only after the password, so it never reveals which accounts exist.
  const refusal = roleRefusal(mode, user.role);
  if (refusal) return { success: false, reason: refusal };

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const sessionResult = db
    .prepare(`INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`)
    .run(user.id, token, expiresAt);

  logActivity(db, {
    userId: user.id,
    sessionId: sessionResult.lastInsertRowid,
    action: 'login',
    description: 'Logged in',
  });

  return { success: true, token, user: toPublicUser(user) };
}

// Lock-screen check: confirms the signed-in user's password without starting
// a session. Same 5-tries lockout as the login screen.
function verifyPassword(userId, password) {
  if (!userId) return { success: false, reason: 'Please sign in again.' };
  if (!password) return { success: false, reason: 'Enter your password.' };
  const lockKey = `lock:${userId}`;
  if (isLockedOut(lockKey)) return { success: false, reason: TOO_MANY_TRIES };
  const user = getDb().prepare('SELECT password_hash, is_active FROM users WHERE id = ?').get(userId);
  if (!user || !user.is_active || !bcrypt.compareSync(password, user.password_hash)) {
    recordWrongTry(lockKey);
    return { success: false, reason: isLockedOut(lockKey) ? TOO_MANY_TRIES : 'Wrong password. Try again.' };
  }
  wrongTries.delete(lockKey);
  return { success: true };
}

// Rule 12: the Admin approval box on the cashier screen. Checks the Admin's
// username + password without signing anyone in or out (the cashier stays
// signed in). Same 5-tries / 5-minutes lockout as the login screen, on the
// same counter, so the box can't be used to guess the Admin password.
function checkAdminCredentials(username, password) {
  if (!username || !password) return { ok: false, reason: 'Type the Admin username and password.' };
  const lockKey = `login:${String(username).toLowerCase()}`;
  if (isLockedOut(lockKey)) return { ok: false, reason: TOO_MANY_TRIES };
  const user = getDb().prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !user.is_active || !bcrypt.compareSync(password, user.password_hash)) {
    recordWrongTry(lockKey);
    return { ok: false, reason: isLockedOut(lockKey) ? TOO_MANY_TRIES : 'Wrong Admin username or password.' };
  }
  wrongTries.delete(lockKey);
  if (user.role !== 'admin') return { ok: false, reason: 'Only the Admin can approve this.' };
  return { ok: true, user: toPublicUser(user) };
}

function validateSession(token, mode) {
  const db = getDb();
  if (!token) return { valid: false };

  const session = db
    .prepare('SELECT * FROM sessions WHERE token = ? AND is_revoked = 0')
    .get(token);

  if (!session) return { valid: false };
  if (new Date(session.expires_at) < new Date()) return { valid: false };

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id);
  if (!user || !user.is_active) return { valid: false };
  if (roleRefusal(mode, user.role)) return { valid: false };

  return { valid: true, user: toPublicUser(user) };
}

function logout(token) {
  const db = getDb();
  if (token) {
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    db.prepare("UPDATE sessions SET is_revoked = 1, ended_at = datetime('now') WHERE token = ?").run(token);
    if (session) {
      logActivity(db, { userId: session.user_id, sessionId: session.id, action: 'logout', description: 'Logged out' });
    }
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

// Development convenience only (index.js calls it when !app.isPackaged): makes
// sure a demo cashier account exists so the cashier side of the login flow can
// be exercised. Safe to call on every startup — a no-op once the account exists.
// Installed builds never create, backfill or touch it.
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
    grant.run(cashier.id, 'add_missing_items', null);
  }

  // record_payment ships granted-by-default for cashiers (revocable later from
  // the Cashiers module's Edit Cashier page) — backfilled here too, so a
  // cashier account created before this permission existed still ends up with it.
  const hasRecordPayment = db
    .prepare('SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_key = ?')
    .get(cashier.id, 'record_payment');
  if (!hasRecordPayment) {
    db.prepare('INSERT INTO user_permissions (user_id, permission_key, value) VALUES (?, ?, NULL)').run(cashier.id, 'record_payment');
  }
}

// ---------------- Cashiers module (admin-only) ----------------
// Every write below used to enqueue a sync_queue entry by hand (admin-outbound
// master data, the opposite direction of the POS module's cashier-outbound
// sales queuing). That table and the manual queuing are gone now — the
// sync_outbox triggers on `users`/`user_permissions` (022_sync_foundation.sql)
// populate the outbox automatically on every INSERT/UPDATE/DELETE, so these
// are no-ops kept only so the call sites below don't need to change.

function queueUserSync() {}

function queuePermissionSync() {}

const USER_SORT_COLUMNS = {
  full_name: 'full_name',
  username: 'username',
  status: 'is_active',
  created_at: 'created_at',
};

// cashiersOnly + search/sort power the Cashiers > All Cashiers page; called
// with no args (the original shape) it's unchanged — every existing caller
// (edit-mode lookup, the Sales Report cashier filter, ...) still gets every
// user, admin first, then cashiers by name.
function list({ search, sortBy, sortDirection, cashiersOnly } = {}) {
  const db = getDb();
  let sql = `SELECT id, full_name, username, role, is_active, created_at FROM users WHERE 1 = 1`;
  const params = [];

  if (cashiersOnly) {
    sql += " AND role = 'cashier'";
  }
  if (search && search.trim()) {
    sql += ' AND (full_name LIKE ? OR username LIKE ?)';
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }

  const sortColumn = USER_SORT_COLUMNS[sortBy];
  if (sortColumn) {
    sql += ` ORDER BY ${sortColumn} ${sortDirection === 'desc' ? 'DESC' : 'ASC'}`;
  } else {
    sql += " ORDER BY (role != 'admin'), full_name";
  }

  return db.prepare(sql).all(...params);
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

  return insertCashier(db, fullName.trim(), username.trim(), bcrypt.hashSync(password, SALT_ROUNDS));
}

// Shared by the Cashiers module and by a counter PC joining the shop from its
// Setup screen (setup/setupManager.js, which hashes on the counter PC so the
// password never crosses the network).
function insertCashier(db, fullName, username, passwordHash) {
  try {
    const result = db
      .prepare(`INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, 'cashier')`)
      .run(fullName, username, passwordHash);

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
    db.prepare("UPDATE sessions SET is_revoked = 1, ended_at = COALESCE(ended_at, datetime('now')) WHERE user_id = ?").run(id);
    sessions.clearSessionsForUser(id);
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
  db.prepare("UPDATE sessions SET is_revoked = 1, ended_at = COALESCE(ended_at, datetime('now')) WHERE user_id = ?").run(id);
  sessions.clearSessionsForUser(id);
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

// ---------------- Session Activity (Cashiers module) ----------------
// Every login is a "session" row; every notable thing a cashier does during
// it (recorded via activity_log — see src/main/activity/activityLog.js) is
// what the click-through detail view shows. Admin's own sessions aren't
// cashier activity, so they're excluded from both queries below.

const SESSION_SORT_COLUMNS = {
  cashier: 'u.full_name',
  login_at: 's.created_at',
  activity_count: 'activity_count',
};

function resolveSessionIsActive(row) {
  return !row.is_revoked && !row.ended_at && new Date(row.expires_at) > new Date();
}

function listSessions({ search, cashierId, sortBy, sortDirection } = {}) {
  const db = getDb();
  let sql = `
    SELECT s.id, s.user_id, u.full_name AS cashier_name, u.username, s.created_at AS login_at,
           s.expires_at, s.ended_at, s.is_revoked,
           (SELECT COUNT(*) FROM activity_log a WHERE a.session_id = s.id) AS activity_count
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE u.role = 'cashier'
  `;
  const params = [];

  if (cashierId) {
    sql += ' AND s.user_id = ?';
    params.push(cashierId);
  }
  if (search && search.trim()) {
    sql += ' AND (u.full_name LIKE ? OR u.username LIKE ?)';
    const like = `%${search.trim()}%`;
    params.push(like, like);
  }

  const sortColumn = SESSION_SORT_COLUMNS[sortBy] || 's.created_at';
  sql += ` ORDER BY ${sortColumn} ${sortDirection === 'asc' ? 'ASC' : 'DESC'}`;

  const rows = db.prepare(sql).all(...params);
  return rows.map((row) => ({ ...row, is_active: resolveSessionIsActive(row) }));
}

function getSessionDetail(sessionId) {
  const db = getDb();
  const session = db
    .prepare(
      `SELECT s.id, s.user_id, u.full_name AS cashier_name, u.username, s.created_at AS login_at,
              s.expires_at, s.ended_at, s.is_revoked
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionId);
  if (!session) return { success: false, reason: 'Session not found.' };

  const activities = db
    .prepare(
      `SELECT id, action, description, reference_type, reference_id, created_at
       FROM activity_log WHERE session_id = ? ORDER BY created_at`
    )
    .all(sessionId);

  return { success: true, session: { ...session, is_active: resolveSessionIsActive(session) }, activities };
}

function registerUsersIpc() {
  // Identity is recorded per window (sessionTracker) — that, not anything the
  // renderer sends later, is what every other handler trusts.
  ipcMain.handle('users:login', (event, { username, password } = {}) => {
    const result = login(username, password, getModeForWebContents(event.sender.id));
    if (result.success) {
      sessions.setSession(event.sender.id, { userId: result.user.id, role: result.user.role, sessionToken: result.token });
    }
    return result;
  });

  ipcMain.handle('users:verify-password', (event, { password } = {}) => verifyPassword(getCaller(event)?.userId, password));

  ipcMain.handle('users:validate-session', (event, { token } = {}) => {
    const result = validateSession(token, getModeForWebContents(event.sender.id));
    if (result.valid) sessions.setSession(event.sender.id, { userId: result.user.id, role: result.user.role, sessionToken: token });
    else sessions.clearSession(event.sender.id);
    return result;
  });

  ipcMain.handle('users:logout', (event, { token } = {}) => {
    sessions.clearSession(event.sender.id);
    return logout(token);
  });

  // Always the caller's own permissions.
  ipcMain.handle('users:get-permissions', (event) => getPermissions(getCaller(event)?.userId));

  ipcMain.handle('users:list', (event, payload) => list(payload || {}));
  ipcMain.handle('users:create-cashier', (event, payload) => createCashier(payload || {}));
  ipcMain.handle('users:update', (event, payload) => updateUser(payload || {}));
  ipcMain.handle('users:check-username-unique', (event, payload) => checkUsernameUnique(payload || {}));
  ipcMain.handle('users:reset-password', (event, payload) => resetPassword(payload || {}));
  ipcMain.handle('users:set-active', (event, payload) => setActive(payload || {}));

  ipcMain.handle('permissions:get-definitions', () => PERMISSION_DEFINITIONS);
  ipcMain.handle('permissions:get-for-user', (event, { userId } = {}) => getPermissionsForUser(userId));
  ipcMain.handle('permissions:save-for-user', (event, payload) => savePermissionsForUser(payload || {}));

  ipcMain.handle('sessions:list', (event, payload) => listSessions(payload || {}));
  ipcMain.handle('sessions:get-detail', (event, { id } = {}) => getSessionDetail(id));
}

// Forget every wrong-password count (the rules-check harness starts each file clean).
function clearLockouts() {
  wrongTries.clear();
}

module.exports = { registerUsersIpc, seedDummyCashier, createFirstAdmin, insertCashier, hasAdminUser, checkAdminCredentials, clearLockouts, SALT_ROUNDS };
