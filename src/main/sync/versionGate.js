// Two computers sync only when they run the same database layout (latest applied
// migration number). Each side announces its app version + migration number in the
// discovery packet and in every /sync/exchange request/response; when they differ the
// exchange is refused both ways BEFORE any record is sent or applied. The outbox keeps
// everything, and syncing resumes by itself once both computers match.
const { app } = require('electron');
const { getSchemaVersion } = require('../db/connection');

const mismatches = new Map(); // peer machineId -> { peerVersion, peerMigration, stationCode, role }

function selfInfo() {
  return { appVersion: app.getVersion(), migration: getSchemaVersion() };
}

function sameLayout(peerMigration) {
  return Number.isInteger(peerMigration) && peerMigration === selfInfo().migration;
}

function peerName(peer) {
  if (peer.stationCode) return peer.stationCode;
  if (peer.role === 'admin') return 'the main computer';
  if (peer.role === 'cashier') return 'the counter computer';
  return 'the other computer';
}

function messageFor(entry) {
  const mine = selfInfo();
  const theirs = entry.peerVersion ? `version ${entry.peerVersion}` : 'an older version';
  return `Paused: ${peerName(entry)} is on ${theirs}, this computer is on version ${mine.appVersion}. Update both computers to the same version.`;
}

// Returns true the first time this peer is marked (so callers can log it once).
function noteMismatch(peer, { appVersion, migration } = {}) {
  const isNew = !mismatches.has(peer.machineId);
  mismatches.set(peer.machineId, {
    peerVersion: appVersion || null,
    peerMigration: Number.isInteger(migration) ? migration : null,
    stationCode: peer.stationCode || null,
    role: peer.role || null,
  });
  return isNew;
}

function clearMismatch(machineId) {
  mismatches.delete(machineId);
}

function getMismatch(machineId) {
  const entry = mismatches.get(machineId);
  return entry ? { ...entry, message: messageFor(entry) } : null;
}

// The first active pause (for this computer's sync chip), or null. `isRelevant(machineId)`
// lets the caller ignore computers that are switched off.
function firstPausedMessage(isRelevant = () => true) {
  for (const [machineId, entry] of mismatches) if (isRelevant(machineId)) return messageFor(entry);
  return null;
}

module.exports = { selfInfo, sameLayout, noteMismatch, clearMismatch, getMismatch, firstPausedMessage };
