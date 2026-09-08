// src/main/sync/discovery.js
//
// Auto-discovery over the shop's WiFi router: every PC broadcasts a small
// "I exist" UDP packet every few seconds and listens for the same from
// everyone else, so no PC ever needs a manually-entered IP address for
// another — see Step 2 of the sync design doc. The broadcast itself carries
// no secret (see 023_sync_secret.sql's comment) — it only announces presence,
// never data.
const dgram = require('dgram');
const { getDb } = require('../db/connection');
const { getMachineId } = require('../license/machineId');

const UDP_PORT = 41234;
const BROADCAST_ADDRESS = '255.255.255.255';
const BROADCAST_INTERVAL_MS = 5000;
const OFFLINE_AFTER_MS = 30000;

// In-memory, keyed by machineId — the source of truth syncEngine reads from
// on every sync tick. Seeded from sync_peer_state on startup (so a peer
// known from a previous session shows up, marked offline, before any
// broadcast is heard this run) and kept warm by incoming packets after that.
const knownPeers = new Map();

let socket = null;
let broadcastTimer = null;

function seedFromDb() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM sync_peer_state').all();
    for (const row of rows) {
      knownPeers.set(row.peer_machine_id, {
        machineId: row.peer_machine_id,
        stationCode: row.peer_station_code,
        role: row.peer_role,
        ip: row.last_known_ip,
        tcpPort: null, // not persisted — only known once a broadcast is actually heard this session
        // Stored as UTC via datetime('now') — same parse convention as
        // renderer/utils/format.js's formatDateTime.
        lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at.replace(' ', 'T') + 'Z').getTime() : 0,
      });
    }
  } catch (err) {
    console.error('[discovery] failed to seed peers from sync_peer_state:', err);
  }
}

function upsertPeerRow(peer) {
  try {
    getDb()
      .prepare(
        `INSERT INTO sync_peer_state (peer_machine_id, peer_station_code, peer_role, last_known_ip, last_seen_at)
         VALUES (@machineId, @stationCode, @role, @ip, datetime('now'))
         ON CONFLICT(peer_machine_id) DO UPDATE SET
           peer_station_code = excluded.peer_station_code,
           peer_role = excluded.peer_role,
           last_known_ip = excluded.last_known_ip,
           last_seen_at = excluded.last_seen_at`
      )
      .run({ machineId: peer.machineId, stationCode: peer.stationCode || null, role: peer.role || null, ip: peer.ip });
  } catch (err) {
    console.error('[discovery] failed to persist peer:', err);
  }
}

function handleMessage(buf, rinfo) {
  let msg;
  try {
    msg = JSON.parse(buf.toString('utf8'));
  } catch {
    return; // not our packet — ignore
  }
  if (!msg || !msg.machineId || msg.machineId === getMachineId()) return;

  const peer = {
    machineId: msg.machineId,
    stationCode: msg.stationCode || null,
    role: msg.role || null,
    ip: rinfo.address,
    tcpPort: msg.tcpPort || null,
    lastSeenAt: Date.now(),
  };
  knownPeers.set(peer.machineId, peer);
  upsertPeerRow(peer);
}

function getSelfBroadcastPayload(tcpPort) {
  try {
    const db = getDb();
    const activation = db.prepare('SELECT station_code, role FROM license_activation WHERE id = 1').get();
    if (!activation) return null; // not set up yet — nothing meaningful to announce, but we still listen
    return JSON.stringify({ machineId: getMachineId(), stationCode: activation.station_code, role: activation.role, tcpPort });
  } catch {
    return null;
  }
}

function startDiscovery(tcpPort) {
  if (socket) return; // already running
  seedFromDb();

  socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('message', handleMessage);
  socket.on('error', (err) => console.error('[discovery] socket error:', err));

  socket.bind(UDP_PORT, () => {
    socket.setBroadcast(true);
  });

  broadcastTimer = setInterval(() => {
    const payload = getSelfBroadcastPayload(tcpPort);
    if (!payload || !socket) return;
    const buf = Buffer.from(payload, 'utf8');
    socket.send(buf, 0, buf.length, UDP_PORT, BROADCAST_ADDRESS, (err) => {
      if (err) console.error('[discovery] broadcast failed:', err.message);
    });
  }, BROADCAST_INTERVAL_MS);
}

function stopDiscovery() {
  clearInterval(broadcastTimer);
  broadcastTimer = null;
  if (socket) {
    socket.close();
    socket = null;
  }
}

// Returns every peer this PC has ever heard from or previously recorded,
// each flagged `online` if it broadcast within the last ~30s — offline peers
// stay in the list (never removed) per Step 2, just marked accordingly.
function getKnownPeers() {
  const now = Date.now();
  return Array.from(knownPeers.values()).map((p) => ({ ...p, online: now - p.lastSeenAt < OFFLINE_AFTER_MS }));
}

module.exports = { startDiscovery, stopDiscovery, getKnownPeers };
