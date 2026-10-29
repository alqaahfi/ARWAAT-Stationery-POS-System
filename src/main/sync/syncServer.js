// src/main/sync/syncServer.js
//
// Every PC — Admin and every Cashier PC alike — runs this small server, not
// just Admin, so Cashier-to-Cashier sync still works if Admin is briefly
// unreachable. One endpoint: a combined push-and-pull in a single call — see
// Step 3 of the sync design doc.
const crypto = require('crypto');
const express = require('express');
const { getDb } = require('../db/connection');
const { applyRecords } = require('./applyIncoming');
const { buildOutgoingRecords } = require('./syncEngine');
const { registerCashierAccount } = require('../setup/setupManager');

let server = null;

// Wrong-secret throttle, per caller IP: 10 misses inside 10 minutes blocks
// that IP for 15 minutes (both endpoints below share it).
const FAIL_LIMIT = 10;
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const failuresByIp = new Map(); // ip -> { count, firstAt, blockedUntil }

function callerIp(req) {
  return (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}

function secretsMatch(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual needs equal lengths; compare against itself so a length
  // mismatch costs the same time and still fails.
  if (a.length !== b.length) {
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function recordFailure(ip) {
  const now = Date.now();
  let entry = failuresByIp.get(ip);
  if (!entry || now - entry.firstAt > FAIL_WINDOW_MS) entry = { count: 0, firstAt: now, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= FAIL_LIMIT) entry.blockedUntil = now + BLOCK_MS;
  failuresByIp.set(ip, entry);
}

function verifySecret(req, res, next) {
  const ip = callerIp(req);
  const entry = failuresByIp.get(ip);
  if (entry && entry.blockedUntil > Date.now()) {
    return res.status(429).json({ error: 'Too many wrong codes. Try again later.', reason: 'Too many wrong codes. Try again in 15 minutes.' });
  }

  const activation = getDb().prepare('SELECT sync_secret FROM station_config WHERE id = 1').get();
  const expected = activation && activation.sync_secret;
  const provided = req.headers['x-sync-secret'];
  // Honest limitation, not solved by this build: this authenticates that the
  // caller knows the shared secret — it does not encrypt the exchange body
  // itself. A sufficiently motivated attacker already on the WiFi could
  // still eavesdrop on sync traffic in transit; TLS would close that gap but
  // is out of scope here.
  if (!expected || !provided || !secretsMatch(provided, expected)) {
    // Before this PC is set up there is no secret to guess, so don't count those.
    if (expected) recordFailure(ip);
    return res.status(401).json({ error: 'Invalid or missing sync secret.' });
  }
  failuresByIp.delete(ip);
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
  const ip = callerIp(req);
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

// A counter PC joining the shop from its Setup screen. Same secret check as a
// sync; the Admin PC creates the cashier account (password arrives pre-hashed)
// so the counter PC's first sync brings it back down like any other user.
function handleRegisterCashier(req, res) {
  const result = registerCashierAccount(req.body || {});
  if (!result.success) return res.status(result.status || 400).json({ reason: result.reason });
  res.json({ shopName: result.shopName });
}

function startSyncServer(port) {
  if (server) return server;
  const app = express();
  // The secret is checked before any body is parsed, so an unauthenticated
  // caller can't make this PC buffer a large payload. 25 MB still fits a bulk
  // product import's outbox batch; registering a cashier needs only a few KB.
  app.post('/sync/exchange', verifySecret, express.json({ limit: '25mb' }), handleExchange);
  app.post('/setup/register-cashier', verifySecret, express.json({ limit: '16kb' }), handleRegisterCashier);

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
