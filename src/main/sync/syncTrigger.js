// src/main/sync/syncTrigger.js
//
// "Immediately (debounced) after any local write completes" (Step 5) without
// touching every module's create/update handlers — the same seam
// devpanel/auditMiddleware.js already uses: patch ipcMain.handle once,
// centrally, before any register*Ipc() call, so every channel any module
// registers goes through this automatically.
//
// Rather than guessing which channel names are "writes", this checks the one
// thing that's actually true regardless of module: did sync_outbox's row
// count grow during this call? The outbox is only ever populated by the
// triggers in 022_sync_foundation.sql, so a growing count means some synced
// table really changed — a precise, generic write-detector for free.
const { getDb } = require('../db/connection');
const { scheduleDebouncedSync } = require('./syncEngine');

function getOutboxCount() {
  try {
    return getDb().prepare('SELECT COUNT(*) AS c FROM sync_outbox').get().c;
  } catch {
    return null; // DB not ready yet — nothing to compare, just skip this call
  }
}

function installSyncTriggerMiddleware(ipcMain) {
  const originalHandle = ipcMain.handle.bind(ipcMain);

  ipcMain.handle = function syncTriggeredHandle(channel, listener) {
    return originalHandle(channel, async (event, ...args) => {
      const before = getOutboxCount();
      const result = await listener(event, ...args);
      const after = getOutboxCount();
      if (before !== null && after !== null && after > before) scheduleDebouncedSync();
      return result;
    });
  };
}

module.exports = { installSyncTriggerMiddleware };
