// src/main/sync/syncEngine.js
//
// Orchestrates one PC's side of a sync: which outbox rows to send a given
// peer, calling that peer's /sync/exchange, applying what comes back, and
// updating this PC's own bookkeeping (sync_peer_state, sync_log). Runs on a
// timer and after local writes (see syncTrigger.js) — see Step 5 of the sync
// design doc.
const { getDb } = require('../db/connection');
const { getMachineId } = require('../license/machineId');
const { SYNC_TABLES } = require('./syncSchema');
const { encodeRow } = require('./recordCodec');
const { applyRecords } = require('./applyIncoming');
const { getKnownPeers } = require('./discovery');

const DEFAULT_SYNC_PORT = 4000;
const DEBOUNCE_MS = 4000; // "immediately, debounced to every few seconds" after a local write
const PERIODIC_MS = 25000; // "automatic every ~15-30 seconds"
const REQUEST_TIMEOUT_MS = 10000;

let debounceTimer = null;
let periodicTimer = null;

function getActivation(db) {
  return db.prepare('SELECT station_code, role, sync_secret FROM license_activation WHERE id = 1').get() || null;
}

// Reads local sync_outbox rows newer than `sinceOutboxId`, deduped to the
// latest operation per (table, uuid) — SQLite guarantees a bare column
// alongside a single MAX() aggregate comes from the row that produced that
// max, which is exactly the "latest op wins" dedup this needs. Returns the
// live row data for each (re-read at send time, not whatever it looked like
// when the outbox row was written) plus the outbox id high-water mark this
// batch represents.
function buildOutgoingRecords(db, sinceOutboxId) {
  const watermark = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM sync_outbox').get().m;

  const groups = db
    .prepare(
      `SELECT table_name, record_uuid, operation, MAX(id) AS latest_id
       FROM sync_outbox WHERE id > ? GROUP BY table_name, record_uuid`
    )
    .all(sinceOutboxId);

  const records = [];
  for (const group of groups) {
    const cfg = SYNC_TABLES[group.table_name];
    if (!cfg) continue; // defensive — every trigger-populated table_name should have a config

    if (group.operation === 'delete') {
      records.push({ table: group.table_name, uuid: group.record_uuid, operation: 'delete' });
      continue;
    }

    const liveRow = db.prepare(`SELECT * FROM ${group.table_name} WHERE uuid = ?`).get(group.record_uuid);
    if (!liveRow) {
      // Created then deleted again before any sync ran — only worth telling
      // the peer if it's a table that can actually accept a delete.
      if (cfg.deletable) records.push({ table: group.table_name, uuid: group.record_uuid, operation: 'delete' });
      continue;
    }

    records.push({
      table: group.table_name,
      uuid: group.record_uuid,
      operation: group.operation,
      data: encodeRow(db, group.table_name, liveRow),
    });
  }

  return { records, watermark };
}

function logSyncResult(db, peer, status, message) {
  db.prepare(
    `INSERT INTO sync_log (direction, status, peer_machine_id, peer_station_code, message)
     VALUES ('exchange', ?, ?, ?, ?)`
  ).run(status, peer.machineId, peer.stationCode || null, message || null);
}

function upsertPeerState(db, peer, { pushedThrough, pulledThrough, ip }) {
  db.prepare(
    `INSERT INTO sync_peer_state
       (peer_machine_id, peer_station_code, peer_role, last_known_ip, last_seen_at,
        last_synced_outbox_id, last_received_outbox_id, last_sync_success_at)
     VALUES (@machineId, @stationCode, @role, @ip, datetime('now'), @pushedThrough, @pulledThrough, datetime('now'))
     ON CONFLICT(peer_machine_id) DO UPDATE SET
       peer_station_code = excluded.peer_station_code,
       peer_role = excluded.peer_role,
       last_known_ip = excluded.last_known_ip,
       last_seen_at = excluded.last_seen_at,
       -- Never move a watermark backwards — a slower/older exchange finishing
       -- after a faster one shouldn't undo progress the faster one recorded.
       last_synced_outbox_id = MAX(last_synced_outbox_id, excluded.last_synced_outbox_id),
       last_received_outbox_id = MAX(last_received_outbox_id, excluded.last_received_outbox_id),
       last_sync_success_at = excluded.last_sync_success_at`
  ).run({
    machineId: peer.machineId,
    stationCode: peer.stationCode || null,
    role: peer.role || null,
    ip,
    pushedThrough,
    pulledThrough,
  });
}

// One combined push-and-pull round trip with a single peer. Throws on
// failure (network error, bad response, non-2xx) — callers decide whether
// to tolerate that; syncWithAllKnownPeers does, so one unreachable peer
// never blocks syncing with the rest.
async function syncWithPeer(peer) {
  const db = getDb();
  const activation = getActivation(db);
  if (!activation) throw new Error('This PC is not activated yet.');

  const peerRow = db.prepare('SELECT * FROM sync_peer_state WHERE peer_machine_id = ?').get(peer.machineId) || {
    last_synced_outbox_id: 0,
    last_received_outbox_id: 0,
  };

  const { records, watermark } = buildOutgoingRecords(db, peerRow.last_synced_outbox_id);
  const port = peer.tcpPort || DEFAULT_SYNC_PORT;
  const url = `http://${peer.ip}:${port}/sync/exchange`;

  let payload;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': activation.sync_secret || '' },
      body: JSON.stringify({
        fromMachineId: getMachineId(),
        fromStationCode: activation.station_code,
        fromRole: activation.role,
        sinceOutboxId: peerRow.last_received_outbox_id,
        callerOutboxWatermark: watermark,
        records,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Peer responded with HTTP ${res.status}`);
    payload = await res.json();
  } catch (err) {
    logSyncResult(db, peer, 'failed', err.message || String(err));
    throw err;
  }

  const applyResult = applyRecords(db, payload.records || []);
  upsertPeerState(db, peer, { pushedThrough: watermark, pulledThrough: payload.newWatermark || 0, ip: peer.ip });

  const summary = `pushed ${records.length}, pulled ${(payload.records || []).length}` +
    (applyResult.skipped ? `, ${applyResult.skipped} skipped (see console)` : '');
  if (applyResult.errors && applyResult.errors.length) {
    console.warn('[sync] some incoming records could not be applied:', applyResult.errors);
  }
  logSyncResult(db, peer, 'success', summary);

  return { success: true, pushed: records.length, pulled: (payload.records || []).length, ...applyResult };
}

// Tries every known peer (from discovery's in-memory map, itself seeded and
// kept warm from UDP broadcasts + sync_peer_state) except this PC's own
// machine id, tolerating individual failures so one offline peer never
// blocks the rest — see Step 5.
async function syncWithAllKnownPeers() {
  const selfId = getMachineId();
  const peers = getKnownPeers().filter((p) => p.machineId !== selfId && p.ip);
  const results = [];
  for (const peer of peers) {
    try {
      results.push({ peer: peer.machineId, ...(await syncWithPeer(peer)) });
    } catch (err) {
      results.push({ peer: peer.machineId, success: false, reason: err.message || String(err) });
    }
  }
  return results;
}

function scheduleDebouncedSync() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    syncWithAllKnownPeers().catch((err) => console.error('[sync] debounced sync failed:', err));
  }, DEBOUNCE_MS);
}

function startPeriodicSync() {
  if (periodicTimer) return;
  periodicTimer = setInterval(() => {
    syncWithAllKnownPeers().catch((err) => console.error('[sync] periodic sync failed:', err));
  }, PERIODIC_MS);
}

function stopSyncTimers() {
  clearTimeout(debounceTimer);
  clearInterval(periodicTimer);
  debounceTimer = null;
  periodicTimer = null;
}

module.exports = {
  DEFAULT_SYNC_PORT,
  buildOutgoingRecords,
  syncWithPeer,
  syncWithAllKnownPeers,
  scheduleDebouncedSync,
  startPeriodicSync,
  stopSyncTimers,
};
