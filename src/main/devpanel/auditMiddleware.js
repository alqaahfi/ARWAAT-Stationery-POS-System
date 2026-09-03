// src/main/devpanel/auditMiddleware.js
//
// Wraps ipcMain.handle so every channel registered anywhere in the app gets
// logged to dev_audit_log automatically — no per-module changes needed. Wire
// this in once, centrally, in src/main/index.js, before any register*Ipc()
// call — see installAuditMiddleware() below for how.
//
// This module is intentionally the ONLY place that writes to dev_audit_log,
// and it never calls any other module's code to do so — it only reads the
// call's own channel/args/result/error and the DB connection.
const { getDb } = require('../db/connection');
const { setCurrentSession, clearCurrentSession, getCurrentSession } = require('./sessionTracker');

// Keys stripped (recursively) from logged args before they're stored, so a
// credential never lands in the audit trail even in summary form. Matched
// case-insensitively against the key name, not the value.
const SENSITIVE_KEY_PATTERN = /password|token|secret|licensekey|license_key/i;

// Caps how much of a call's arguments we keep per row — some handlers (bulk
// import, bulk queries) take large payloads that would otherwise bloat the
// table for no diagnostic benefit.
const ARGS_SUMMARY_MAX_LENGTH = 2000;

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitize(val);
    }
    return out;
  }
  return value;
}

function summarizeArgs(args) {
  try {
    const sanitized = sanitize(args.length ? (args.length === 1 ? args[0] : args) : undefined);
    const json = JSON.stringify(sanitized);
    if (!json) return null;
    return json.length > ARGS_SUMMARY_MAX_LENGTH ? json.slice(0, ARGS_SUMMARY_MAX_LENGTH) + '…' : json;
  } catch {
    return '[unserializable]';
  }
}

function getStationCode() {
  try {
    const row = getDb().prepare('SELECT station_code FROM license_activation WHERE id = 1').get();
    return row?.station_code || null;
  } catch {
    return null;
  }
}

// Mirrors the outcome of the three existing auth channels into
// sessionTracker so the rest of the audit trail can attribute calls to a
// user — see sessionTracker.js for why this is necessary.
function trackSessionFromResult(channel, result) {
  if (channel === 'users:login' && result?.success) setCurrentSession(result.user);
  if (channel === 'users:validate-session' && result?.valid) setCurrentSession(result.user);
  if (channel === 'users:logout') clearCurrentSession();
}

function writeAuditRow({ channel, argsSummary, success, errorMessage, durationMs }) {
  try {
    const session = getCurrentSession();
    getDb()
      .prepare(
        `INSERT INTO dev_audit_log
           (channel, user_id, user_role, station_code, args_summary, success, error_message, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        channel,
        session.userId,
        session.role,
        getStationCode(),
        argsSummary,
        success ? 1 : 0,
        errorMessage || null,
        durationMs
      );
  } catch (err) {
    // The audit trail must never be able to break the app it's watching.
    console.error('[devpanel] failed to write audit log row:', err);
  }
}

// Every module in this app does `const { ipcMain } = require('electron')` and
// calls `ipcMain.handle(...)` directly — there's no parameter to swap in a
// wrapped instance without touching every module. Electron's `ipcMain` is a
// singleton, though, so patching its `.handle` method in place — once,
// before any register*Ipc() runs — makes every module's own, unmodified
// `ipcMain.handle(...)` call go through the audited version automatically.
function installAuditMiddleware(ipcMain) {
  const originalHandle = ipcMain.handle.bind(ipcMain);

  ipcMain.handle = function auditedHandle(channel, listener) {
    return originalHandle(channel, async (event, ...args) => {
      const startedAt = Date.now();
      const argsSummary = summarizeArgs(args);
      try {
        const result = await listener(event, ...args);
        trackSessionFromResult(channel, result);
        writeAuditRow({ channel, argsSummary, success: true, durationMs: Date.now() - startedAt });
        return result;
      } catch (err) {
        writeAuditRow({
          channel,
          argsSummary,
          success: false,
          errorMessage: err?.message || String(err),
          durationMs: Date.now() - startedAt,
        });
        throw err;
      }
    });
  };
}

// Retention: dev_audit_log records every IPC call app-wide (including
// search-as-you-type), so it can grow large fast. Called once on startup —
// default policy is "delete anything older than 90 days, then cap at
// 200,000 rows total, oldest first". Adjust the two constants below if that
// default stops fitting.
const RETENTION_DAYS = 90;
const MAX_ROWS = 200000;

function pruneAuditLog() {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM dev_audit_log WHERE occurred_at < datetime('now', '-${RETENTION_DAYS} days')`).run();

    const { count } = db.prepare('SELECT COUNT(*) AS count FROM dev_audit_log').get();
    if (count > MAX_ROWS) {
      db.prepare(
        `DELETE FROM dev_audit_log WHERE id IN (
           SELECT id FROM dev_audit_log ORDER BY occurred_at ASC, id ASC LIMIT ?
         )`
      ).run(count - MAX_ROWS);
    }
  } catch (err) {
    console.error('[devpanel] failed to prune audit log:', err);
  }
}

module.exports = { installAuditMiddleware, pruneAuditLog };
