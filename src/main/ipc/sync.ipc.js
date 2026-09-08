const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getKnownPeers } = require('../sync/discovery');
const { syncWithAllKnownPeers, syncWithPeer } = require('../sync/syncEngine');

function getStatus() {
  const db = getDb();
  const activation = db.prepare('SELECT * FROM license_activation WHERE id = 1').get();
  const outboxCount = db.prepare('SELECT COUNT(*) AS c FROM sync_outbox').get().c;
  const lastSync = db.prepare('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 1').get() || null;

  return {
    thisPc: activation
      ? {
          role: activation.role,
          stationCode: activation.station_code || null,
          shopName: activation.shop_name,
          activatedAt: activation.activated_at,
        }
      : null,
    outboxCount,
    lastSync,
  };
}

function getLog() {
  const db = getDb();
  return db.prepare('SELECT * FROM sync_log ORDER BY created_at DESC LIMIT 200').all();
}

// Merges discovery's live in-memory view (who's actually broadcasting right
// now, and on what IP) with sync_peer_state's durable history (when we last
// successfully synced with them) — either source alone is incomplete: a
// freshly-restarted PC has DB history but no live sighting yet, and a peer
// heard on the network this session may not have synced successfully before.
function getPeers() {
  const db = getDb();
  const live = new Map(getKnownPeers().map((p) => [p.machineId, p]));
  const rows = db.prepare('SELECT * FROM sync_peer_state').all();

  const merged = new Map();
  for (const row of rows) {
    const seen = live.get(row.peer_machine_id);
    merged.set(row.peer_machine_id, {
      machineId: row.peer_machine_id,
      stationCode: (seen && seen.stationCode) || row.peer_station_code,
      role: (seen && seen.role) || row.peer_role,
      ip: (seen && seen.ip) || row.last_known_ip,
      online: !!(seen && seen.online),
      lastSeenAt: row.last_seen_at,
      lastSyncSuccessAt: row.last_sync_success_at,
    });
  }
  // A peer discovery has heard from but that has no sync_peer_state row yet
  // (shouldn't normally happen — discovery upserts one on every packet — but
  // covers the brief window before that first upsert lands).
  for (const [machineId, peer] of live) {
    if (!merged.has(machineId)) {
      merged.set(machineId, {
        machineId,
        stationCode: peer.stationCode,
        role: peer.role,
        ip: peer.ip,
        online: peer.online,
        lastSeenAt: null,
        lastSyncSuccessAt: null,
      });
    }
  }
  return Array.from(merged.values());
}

// The honest oversell case (Step 4) — a variant whose stock_qty went
// negative because two offline-from-each-other PCs both sold the last unit.
// A live query rather than a persisted flag: it's always accurate, and it
// naturally clears itself once someone corrects it via Stock Adjustments.
function getReconciliationWarnings() {
  const db = getDb();
  return db
    .prepare(
      `SELECT pv.id AS variantId, pv.variant_name AS variantName, pv.stock_qty AS stockQty,
              p.id AS productId, p.name AS productName, p.sku
       FROM product_variants pv JOIN products p ON p.id = pv.product_id
       WHERE pv.stock_qty < 0
       ORDER BY pv.stock_qty ASC`
    )
    .all();
}

function getSecret() {
  const row = getDb().prepare('SELECT sync_secret FROM license_activation WHERE id = 1').get();
  return row ? row.sync_secret : null;
}

// Manual "Sync Now" — global (no peer given) or targeted at one peer.
function triggerNow(peerMachineId) {
  if (!peerMachineId) return syncWithAllKnownPeers();
  const peer = getKnownPeers().find((p) => p.machineId === peerMachineId);
  if (!peer) return Promise.resolve([{ peer: peerMachineId, success: false, reason: 'Peer not currently known.' }]);
  return syncWithPeer(peer)
    .then((result) => [{ peer: peerMachineId, ...result }])
    .catch((err) => [{ peer: peerMachineId, success: false, reason: err.message || String(err) }]);
}

function registerSyncIpc() {
  ipcMain.handle('sync:get-status', () => getStatus());
  ipcMain.handle('sync:get-log', () => getLog());
  ipcMain.handle('sync:get-peers', () => getPeers());
  ipcMain.handle('sync:trigger-now', (event, payload) => triggerNow(payload && payload.peerMachineId));
  ipcMain.handle('sync:get-reconciliation-warnings', () => getReconciliationWarnings());
  ipcMain.handle('sync:get-secret', () => getSecret());
}

module.exports = { registerSyncIpc };
