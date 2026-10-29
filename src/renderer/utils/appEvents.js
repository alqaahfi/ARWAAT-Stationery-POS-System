// Window events shared across distant parts of the app.

// Fired (by preload.js) after any call that can change stock levels or the
// product list; the header's alert badge listens so Running Low never goes stale.
export const STOCK_CHANGED_EVENT = 'pos:stock-changed';

// Set by preload.js when the main process says this window's session ended;
// AuthContext returns to Login.
export const SESSION_ENDED_EVENT = 'pos:session-ended';

// A sale / quick bill is being saved right now. The idle auto-lock
// (layout/LockScreen.jsx) never locks while this is above zero.
let savesInProgress = 0;

export async function whileSaving(fn) {
  savesInProgress += 1;
  try {
    return await fn();
  } finally {
    savesInProgress -= 1;
  }
}

export function isSaving() {
  return savesInProgress > 0;
}
