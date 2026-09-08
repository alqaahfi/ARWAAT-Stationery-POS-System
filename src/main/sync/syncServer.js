// src/main/sync/syncServer.js
//
// Every PC — Admin and every Cashier PC alike — runs this small server, not
// just Admin, so Cashier-to-Cashier sync still works if Admin is briefly
// unreachable. One endpoint: a combined push-and-pull in a single call — see
// Step 3 of the sync design doc.
const express = require('express');
const { getDb } = require('../db/connection');
const { applyRecords } = require('./applyIncoming');
const { buildOutgoingRecords } = require('./syncEngine');

let server = null;

function verifySecret(req, res, next) {
  const activation = getDb().prepare('SELECT sync_secret FROM license_activation WHERE id = 1').get();
  const expected = activation && activation.sync_secret;
  const provided = req.headers['x-sync-secret'];
  // Honest limitation, not solved by this build: this authenticates that the
  // caller knows the shared secret — it does not encrypt the exchange body
  // itself. A sufficiently motivated attacker already on the WiFi could
  // still eavesdrop on sync traffic in transit; TLS would close that gap but
  // is out of scope here.
  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing sync secret.' });
  }
  next();
}

function handleExchange(req, res) {
  const db = getDb();
  const { fromMachineId, fromStationCode, fromRole, sinceOutboxId, callerOutboxWatermark, records } = req.body || {};
  if (!fromMachineId) return res.status(400).json({ error: 'Missing fromMachineId.' });

  let applyResult;
  try {
    applyResult = applyRecords(db, records || []);
  } catch (err) {
    console.error('[syncServer] failed to apply incoming records:', err);
    return res.status(500).json({ error: 'Failed to apply incoming records.' });
  }
  if (applyResult.errors && applyResult.errors.length) {
    console.warn('[syncServer] some incoming records could not be applied:', applyResult.errors);
  }

  const { records: outgoing, watermark } = buildOutgoingRecords(db, sinceOutboxId || 0);

  // Records this caller as a known peer even if discovery's UDP broadcast
  // hasn't reached us yet, and remembers how far into the caller's outbox we
  // now are. Deliberately does NOT touch last_synced_outbox_id here — see
  // syncEngine.js's upsertPeerState comment: only a confirmed round trip
  // (the caller side, once it has this response in hand) gets to advance
  // "how much of my own outbox does this peer have."
  const ip = (req.ip || '').replace(/^::ffff:/, '');
  db.prepare(
    `INSERT INTO sync_peer_state (peer_machine_id, peer_station_code, peer_role, last_known_ip, last_seen_at, last_received_outbox_id)
     VALUES (@machineId, @stationCode, @role, @ip, datetime('now'), @received)
     ON CONFLICT(peer_machine_id) DO UPDATE SET
       peer_station_code = excluded.peer_station_code,
       peer_role = excluded.peer_role,
       last_known_ip = excluded.last_known_ip,
       last_seen_at = excluded.last_seen_at,
       last_received_outbox_id = MAX(last_received_outbox_id, excluded.last_received_outbox_id)`
  ).run({
    machineId: fromMachineId,
    stationCode: fromStationCode || null,
    role: fromRole || null,
    ip,
    received: callerOutboxWatermark || 0,
  });

  res.json({ records: outgoing, newWatermark: watermark });
}

function startSyncServer(port) {
  if (server) return server;
  const app = express();
  app.use(express.json({ limit: '25mb' })); // a bulk product import's outbox batch can be sizeable
  app.post('/sync/exchange', verifySecret, handleExchange);

  server = app.listen(port, () => console.log(`[syncServer] listening on port ${port}`));
  server.on('error', (err) => console.error('[syncServer] failed to start:', err.message));
  return server;
}

function stopSyncServer() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { startSyncServer, stopSyncServer };
