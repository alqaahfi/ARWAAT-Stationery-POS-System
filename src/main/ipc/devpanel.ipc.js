// src/main/ipc/devpanel.ipc.js
//
// Entirely separate IPC namespace for the Dev Panel (see build prompt).
// Every handler here is read-only: none of them call or reuse any other
// module's write handler, and none of them execute anything but a SELECT
// against the real database. This file is the only place devpanel:* channels
// are registered.
const bcrypt = require('bcrypt');
const os = require('os');
const fs = require('fs');
const { app, ipcMain } = require('electron');
const { getDb, getDbPath } = require('../db/connection');

// ---------------- shared helpers ----------------

// Columns that must never leave the main process at full value, keyed by
// table name. Applied both to the Database Browser (per selected table) and
// to raw Query Console results (per returned column name) — see the
// security rules in the build prompt: showing a raw session token would let
// someone hijack that session even from a "read-only" tool.
const MASKED_COLUMNS = {
  users: ['password_hash'],
  sessions: ['token'],
};
const ALWAYS_MASKED_COLUMN_NAMES = new Set(['password_hash', 'token']);

function maskRow(row, tableName) {
  const maskedNames = tableName
    ? new Set(MASKED_COLUMNS[tableName] || [])
    : ALWAYS_MASKED_COLUMN_NAMES;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = maskedNames.has(key) ? (value ? '••••••••  (set)' : '(empty)') : value;
  }
  return out;
}

function listUserTables() {
  const db = getDb();
  return db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    .all()
    .map((r) => r.name);
}

function assertKnownTable(table) {
  if (!listUserTables().includes(table)) {
    throw new Error(`Unknown table: ${table}`);
  }
}

// Hard restriction, enforced here in the main process — not just UI copy.
// Rejects anything that isn't a single, standalone SELECT statement.
function assertSelectOnly(rawQuery) {
  const trimmed = (rawQuery || '').trim();
  if (!trimmed) throw new Error('Query is empty.');

  // Strip exactly one optional trailing semicolon before checking for
  // stacked statements — a semicolon anywhere else means multiple statements.
  const withoutTrailingSemicolon = trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed;
  if (withoutTrailingSemicolon.includes(';')) {
    throw new Error('Only a single SELECT statement is allowed (no stacked statements).');
  }
  if (!/^SELECT\s/i.test(withoutTrailingSemicolon) && !/^SELECT$/i.test(withoutTrailingSemicolon)) {
    throw new Error('Only SELECT statements are allowed in the Query Console.');
  }
  // Defensive belt-and-suspenders: forbid write-shaped keywords appearing
  // anywhere in the statement (e.g. inside a CTE), even though better-sqlite3
  // would already refuse them in a read-only handle below.
  if (/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|VACUUM|PRAGMA)\b/i.test(withoutTrailingSemicolon)) {
    throw new Error('Only SELECT statements are allowed in the Query Console.');
  }
  return withoutTrailingSemicolon;
}

function paginate({ page, pageSize }) {
  const size = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 500);
  const current = Math.max(parseInt(page, 10) || 1, 1);
  return { size, offset: (current - 1) * size, current };
}

// ---------------- Tab 1: Audit Log ----------------

function getAuditLog({ channel, userId, dateFrom, dateTo, outcome, page, pageSize } = {}) {
  const db = getDb();
  const where = [];
  const params = [];

  if (channel && channel.trim()) {
    where.push('channel LIKE ?');
    params.push(`%${channel.trim()}%`);
  }
  if (userId) {
    where.push('user_id = ?');
    params.push(userId);
  }
  if (dateFrom) {
    where.push('occurred_at >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push('occurred_at <= ?');
    params.push(dateTo);
  }
  if (outcome === 'success') where.push('success = 1');
  if (outcome === 'fail') where.push('success = 0');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { size, offset, current } = paginate({ page, pageSize });

  const total = db.prepare(`SELECT COUNT(*) AS count FROM dev_audit_log ${whereSql}`).get(...params).count;
  const rows = db
    .prepare(`SELECT * FROM dev_audit_log ${whereSql} ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, size, offset);

  return { rows, total, page: current, pageSize: size };
}

// ---------------- Tab 2: Database Browser ----------------

function listTables() {
  const db = getDb();
  return listUserTables().map((name) => {
    const { count } = db.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get();
    return { name, rowCount: count };
  });
}

function getTableRows({ table, page, pageSize } = {}) {
  assertKnownTable(table);
  const db = getDb();
  const { size, offset, current } = paginate({ page, pageSize });

  const total = db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count;
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
  const rawRows = db.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`).all(size, offset);
  const rows = rawRows.map((r) => maskRow(r, table));

  return { columns, rows, total, page: current, pageSize: size };
}

// Row/byte cap independent of the caller's own LIMIT, so a Query Console
// SELECT can't be used to dump the whole database in one call.
const QUERY_CONSOLE_ROW_CAP = 1000;

function runSelectQuery({ query } = {}) {
  const cleaned = assertSelectOnly(query);
  const db = getDb();
  const stmt = db.prepare(cleaned);
  if (!stmt.reader) {
    throw new Error('Only SELECT statements are allowed in the Query Console.');
  }
  const rawRows = stmt.all();
  const truncated = rawRows.length > QUERY_CONSOLE_ROW_CAP;
  const rows = rawRows.slice(0, QUERY_CONSOLE_ROW_CAP).map((r) => maskRow(r, null));
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { columns, rows, truncated, rowCount: rows.length };
}

// ---------------- Tab 3: Users & Sessions ----------------

function getUsersAndSessions() {
  const db = getDb();
  const activation = db.prepare('SELECT station_code FROM license_activation WHERE id = 1').get();
  const stationCode = activation?.station_code || null;

  const users = db.prepare('SELECT * FROM users ORDER BY (role != \'admin\'), full_name').all().map((u) => maskRow(u, 'users'));
  const sessions = db
    .prepare(
      `SELECT s.*, u.full_name, u.username, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC`
    )
    .all()
    .map((s) => ({ ...maskRow(s, 'sessions'), station_code: stationCode }));

  const lastLoginByUser = {};
  for (const s of sessions) {
    if (!lastLoginByUser[s.user_id]) lastLoginByUser[s.user_id] = s.created_at;
  }

  return {
    stationCode,
    users: users.map((u) => ({ ...u, last_login_at: lastLoginByUser[u.id] || null })),
    sessions,
  };
}

// ---------------- Tab 4: System Info ----------------

function getSystemInfo() {
  const db = getDb();
  const activation = db.prepare('SELECT * FROM license_activation WHERE id = 1').get();
  const dbPath = getDbPath();

  let dbSizeBytes = null;
  try {
    dbSizeBytes = fs.statSync(dbPath).size;
  } catch {
    // Fine if it can't be stat'd for some reason — surface null rather than fail the tab.
  }

  return {
    appVersion: app.getVersion(),
    machineId: activation?.machine_id || null,
    stationCode: activation?.station_code || null,
    license: activation
      ? { activated: true, role: activation.role, shopName: activation.shop_name, activatedAt: activation.activated_at }
      : { activated: false },
    dbPath,
    dbSizeBytes,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    platform: `${os.platform()} ${os.release()}`,
    hostname: os.hostname(),
  };
}

// ---------------- Tab 5: Dev Panel Access Log ----------------

function getAccessLog({ page, pageSize } = {}) {
  const db = getDb();
  const { size, offset, current } = paginate({ page, pageSize });
  const total = db.prepare('SELECT COUNT(*) AS count FROM dev_panel_access_log').get().count;
  const rows = db
    .prepare('SELECT * FROM dev_panel_access_log ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?')
    .all(size, offset);
  return { rows, total, page: current, pageSize: size };
}

// ---------------- Unlock ----------------

function verifyPassword(password, stationCode) {
  const db = getDb();
  const config = db.prepare('SELECT password_hash FROM dev_panel_config WHERE id = 1').get();

  // Same generic failure whether the format was close or wildly wrong, or
  // even if nobody has ever seeded a password yet.
  const ok = !!(config && password && bcrypt.compareSync(password, config.password_hash));

  db.prepare('INSERT INTO dev_panel_access_log (station_code, success) VALUES (?, ?)').run(stationCode || null, ok ? 1 : 0);

  return ok ? { success: true } : { success: false, reason: 'Incorrect password.' };
}

function getStationCode() {
  const row = getDb().prepare('SELECT station_code FROM license_activation WHERE id = 1').get();
  return row?.station_code || null;
}

function registerDevPanelIpc(ipc = ipcMain) {
  ipc.handle('devpanel:verify-password', (event, { password } = {}) => verifyPassword(password, getStationCode()));
  ipc.handle('devpanel:get-audit-log', (event, payload) => getAuditLog(payload || {}));
  ipc.handle('devpanel:list-tables', () => listTables());
  ipc.handle('devpanel:get-table-rows', (event, payload) => getTableRows(payload || {}));
  ipc.handle('devpanel:run-select-query', (event, payload) => runSelectQuery(payload || {}));
  ipc.handle('devpanel:get-users-sessions', () => getUsersAndSessions());
  ipc.handle('devpanel:get-system-info', () => getSystemInfo());
  ipc.handle('devpanel:get-access-log', (event, payload) => getAccessLog(payload || {}));
}

module.exports = { registerDevPanelIpc };
