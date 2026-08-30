const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');

// The real Sync engine (the thing that actually moves sync_queue rows
// between PCs) isn't built yet — this just surfaces what's already sitting
// in this PC's own local tables (its own activation row, its outbound queue
// depth, its sync_log history) so the Settings > Sync & PCs page has
// something honest to show ahead of that.
function getSyncStatus() {
  const db = getDb();
  const activation = db.prepare('SELECT * FROM license_activation WHERE id = 1').get();
  const pendingCount = db.prepare('SELECT COUNT(*) AS count FROM sync_queue WHERE is_synced = 0').get().count;
  const lastSync = db.prepare('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 1').get() || null;

  return {
    thisPc: activation
      ? {
          role: activation.role,
          stationCode: activation.station_code || null,
          shopName: activation.shop_name,
          adminHost: activation.admin_host || null,
          activatedAt: activation.activated_at,
        }
      : null,
    pendingCount,
    lastSync,
  };
}

function getSyncLog() {
  const db = getDb();
  return db.prepare('SELECT id, direction, status, message, created_at FROM sync_log ORDER BY created_at DESC LIMIT 200').all();
}

function registerSyncIpc() {
  ipcMain.handle('sync:get-status', () => getSyncStatus());
  ipcMain.handle('sync:get-log', () => getSyncLog());
}

module.exports = { registerSyncIpc };
