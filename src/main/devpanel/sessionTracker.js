// src/main/devpanel/sessionTracker.js
//
// The main process's own record of who is signed in, per window. Two app
// windows (Admin + Cashier) can be open at once on one PC, each with its own
// signed-in user, so identity is keyed by webContents id — never by anything
// the renderer sends.
//
//   app window   — set by users:login / users:validate-session (users.ipc.js),
//                  cleared by users:logout, a session revoke, or the window closing.
//   print window — a hidden ?print=1 window main creates for printing / PDF
//                  export. It never signs in; it borrows the identity of the
//                  window that asked for it (see windows.js).
//
// The IPC guard (security/ipcGuard.js) reads this to authorise every call, and
// the audit middleware reads it to attribute audit rows.
const entries = new Map(); // webContents.id -> { userId, role, sessionToken, isPrintWindow }
const devUnlocked = new Set(); // webContents ids whose Dev Panel password was accepted

function setSession(webContentsId, { userId, role, sessionToken }) {
  entries.set(webContentsId, { userId, role, sessionToken, isPrintWindow: false });
}

function clearSession(webContentsId) {
  entries.delete(webContentsId);
}

function linkPrintWindow(webContentsId, caller) {
  if (!caller || !caller.userId) return;
  entries.set(webContentsId, {
    userId: caller.userId,
    role: caller.role,
    sessionToken: caller.sessionToken,
    isPrintWindow: true,
  });
}

function getSession(webContentsId) {
  return entries.get(webContentsId) || null;
}

// A deactivated cashier or a password reset ends that user's sessions in every
// window at once (print windows borrowing them included).
function clearSessionsForUser(userId) {
  for (const [id, entry] of entries) {
    if (entry.userId === userId) entries.delete(id);
  }
}

function markDevUnlocked(webContentsId) {
  devUnlocked.add(webContentsId);
}

function isDevUnlocked(webContentsId) {
  return devUnlocked.has(webContentsId);
}

// Window closed / destroyed.
function forgetWebContents(webContentsId) {
  entries.delete(webContentsId);
  devUnlocked.delete(webContentsId);
}

module.exports = {
  setSession,
  clearSession,
  linkPrintWindow,
  getSession,
  clearSessionsForUser,
  markDevUnlocked,
  isDevUnlocked,
  forgetWebContents,
};
