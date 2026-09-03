// src/main/devpanel/sessionTracker.js
//
// The app has no main-process notion of "who's currently logged in" — auth
// is entirely token-based, validated per-call from whatever the renderer
// happens to pass (see src/main/ipc/users.ipc.js). Most IPC calls don't pass
// a token at all. So the audit middleware can't attribute a call to a user
// by inspecting its own arguments.
//
// Instead, since this is a single-window desktop app (one signed-in
// user/session per running process), auditMiddleware.js watches the results
// of the three auth channels that already exist (users:login,
// users:validate-session, users:logout) as they flow through the wrapper it
// installs anyway, and mirrors the outcome here. No other module needs to
// change for the audit trail to know who's acting.
let current = { userId: null, role: null };

function setCurrentSession(user) {
  current = user ? { userId: user.id, role: user.role } : { userId: null, role: null };
}

function clearCurrentSession() {
  current = { userId: null, role: null };
}

function getCurrentSession() {
  return current;
}

module.exports = { setCurrentSession, clearCurrentSession, getCurrentSession };
