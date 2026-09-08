// src/main/sync/recordCodec.js
//
// Turns a local DB row into a wire-safe payload (encodeRow, used when
// building what we send) and back into a local DB row (decodeRow, used when
// applying what we receive) — the two halves of the uuid-instead-of-local-id
// translation described in syncSchema.js. Kept separate from syncEngine.js
// (which only cares about *which* records to send) and applyIncoming.js
// (which only cares about *how* to write a decoded row to each kind of
// table) so this uuid<->id mechanics lives in exactly one place.
const { SYNC_TABLES, getTableColumns } = require('./syncSchema');

// Thrown by decodeRow when a required (non-nullable) reference's uuid isn't
// known locally yet — NOT necessarily an error, just means "try this record
// again after the rest of the batch has had a chance to create that row"
// (see applyIncoming.js's retry loop). A batch always carries a whole
// transaction's worth of related records together, but a parent can still
// land after its child within the same array.
class MissingReferenceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MissingReferenceError';
  }
}

function refFieldName(column) {
  return `${column}__uuid`;
}

// row -> wire payload. `row` is a live `SELECT * FROM table WHERE uuid = ?`
// result; `db` is only used to look up the uuids of whatever it references.
function encodeRow(db, table, row) {
  const cfg = SYNC_TABLES[table];
  const payload = { ...row };
  delete payload.id;
  for (const col of cfg.exclude || []) delete payload[col];

  for (const [col, ref] of Object.entries(cfg.fks || {})) {
    const localId = payload[col];
    delete payload[col];
    if (localId === null || localId === undefined) {
      payload[refFieldName(col)] = null;
      continue;
    }
    const found = db.prepare(`SELECT uuid FROM ${ref.table} WHERE id = ?`).get(localId);
    // Should never happen (every fk target is itself a synced, uuid-bearing
    // table) — surfaced loudly rather than silently dropping the reference.
    if (!found) throw new Error(`encodeRow: ${table}.${col} = ${localId} has no matching row in ${ref.table}`);
    payload[refFieldName(col)] = found.uuid;
  }

  if (cfg.polymorphicFk) {
    const { column, typeColumn, targets } = cfg.polymorphicFk;
    const localId = payload[column];
    const targetTable = targets[payload[typeColumn]];
    delete payload[column];
    if (localId === null || localId === undefined || !targetTable) {
      payload[refFieldName(column)] = null;
    } else {
      const found = db.prepare(`SELECT uuid FROM ${targetTable} WHERE id = ?`).get(localId);
      if (!found) throw new Error(`encodeRow: ${table}.${column} = ${localId} has no matching row in ${targetTable}`);
      payload[refFieldName(column)] = found.uuid;
    }
  }

  return payload;
}

// wire payload -> local row (fk uuids resolved to this PC's own local ids).
// Throws MissingReferenceError if a required reference can't be resolved yet.
function decodeRow(db, table, payload) {
  const cfg = SYNC_TABLES[table];
  const columns = getTableColumns(db, table);
  const row = {};
  // Only ever copy columns this table actually has — payload is untrusted
  // wire data (a peer that knows the shared secret is still just another PC
  // on the LAN), and column names get interpolated into SQL text below
  // since sqlite can't parameterize identifiers, so this whitelist is the
  // injection guard, not just tidiness.
  for (const [key, value] of Object.entries(payload)) {
    if (columns.has(key)) row[key] = value;
  }
  for (const col of cfg.exclude || []) delete row[col];

  for (const [col, ref] of Object.entries(cfg.fks || {})) {
    const uuidVal = payload[refFieldName(col)];
    if (uuidVal === null || uuidVal === undefined) {
      if (!ref.nullable) throw new MissingReferenceError(`${table}.${col} is required but no reference was sent`);
      row[col] = null;
      continue;
    }
    const found = db.prepare(`SELECT id FROM ${ref.table} WHERE uuid = ?`).get(uuidVal);
    if (!found) throw new MissingReferenceError(`${table}.${col} -> ${ref.table}:${uuidVal} not synced locally yet`);
    row[col] = found.id;
  }

  if (cfg.polymorphicFk) {
    const { column, typeColumn, targets } = cfg.polymorphicFk;
    const uuidVal = payload[refFieldName(column)];
    const targetTable = targets[row[typeColumn]];
    if (uuidVal === null || uuidVal === undefined || !targetTable) {
      row[column] = null;
    } else {
      const found = db.prepare(`SELECT id FROM ${targetTable} WHERE uuid = ?`).get(uuidVal);
      if (!found) throw new MissingReferenceError(`${table}.${column} -> ${targetTable}:${uuidVal} not synced locally yet`);
      row[column] = found.id;
    }
  }

  return row;
}

module.exports = { encodeRow, decodeRow, MissingReferenceError };
