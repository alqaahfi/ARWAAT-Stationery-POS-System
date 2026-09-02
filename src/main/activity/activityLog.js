// Shared by anything that records what a cashier did during a session
// (users.ipc.js for login/logout, sales.ipc.js for completed sales, ...) so
// there's one definition of "how an activity row gets written" and one place
// that resolves "which session is this action part of".

// Sessions don't get cleaned up on expiry — a session is "active" here the
// same way users.ipc.js's validateSession() decides it (Date comparison,
// not a SQL string compare, since expires_at is stored as an ISO string
// while SQLite's datetime('now') uses a different format).
function getActiveSessionId(db, userId) {
  const rows = db
    .prepare(`SELECT id, expires_at FROM sessions WHERE user_id = ? AND is_revoked = 0 AND ended_at IS NULL ORDER BY created_at DESC`)
    .all(userId);
  const now = new Date();
  const active = rows.find((r) => new Date(r.expires_at) > now);
  return active ? active.id : null;
}

// sessionId is optional — pass it when the caller already knows it (login/
// logout, where it comes straight from the sessions row being written);
// otherwise it's resolved from the user's current active session, so
// call sites elsewhere (e.g. a completed sale) don't need to thread a
// session token through their whole payload just to log against it.
function logActivity(db, { userId, sessionId, action, description, referenceType, referenceId }) {
  const resolvedSessionId = sessionId !== undefined ? sessionId : getActiveSessionId(db, userId);
  db.prepare(
    `INSERT INTO activity_log (session_id, user_id, action, description, reference_type, reference_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(resolvedSessionId, userId, action, description || null, referenceType || null, referenceId || null);
}

module.exports = { logActivity, getActiveSessionId };
