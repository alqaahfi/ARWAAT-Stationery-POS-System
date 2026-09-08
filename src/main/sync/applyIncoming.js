// src/main/sync/applyIncoming.js
//
// The receiving side of a sync exchange: given a batch of records (from
// either the response half of a call we initiated, or the push half of a
// call a peer made to us), write each one into the local DB. See Step 4 of
// the sync design doc for the per-kind rules this implements.
const { SYNC_TABLES } = require('./syncSchema');
const { decodeRow, MissingReferenceError } = require('./recordCodec');

function insertRow(db, table, row) {
  const cols = Object.keys(row);
  const placeholders = cols.map((c) => `@${c}`).join(', ');
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(row);
}

function updateRow(db, table, row) {
  const cols = Object.keys(row).filter((c) => c !== 'uuid');
  if (!cols.length) return;
  const setClause = cols.map((c) => `${c} = @${c}`).join(', ');
  db.prepare(`UPDATE ${table} SET ${setClause} WHERE uuid = @uuid`).run(row);
}

// stock_movements is never generic upsert — dedup by uuid first (the
// critical step), then apply the movement's quantity as a delta to the
// variant's stock_qty cache. Never recomputed from scratch, never clamped:
// an oversell that goes negative here is a real reconciliation case, left
// visible on purpose (see Step 4 / the Sync & PCs page's negative-stock
// query) rather than silently hidden by clamping to zero.
function applyStockMovement(db, uuid, payload) {
  const already = db.prepare('SELECT 1 FROM stock_movements WHERE uuid = ?').get(uuid);
  if (already) return; // seen this movement before — skip entirely, per spec

  const row = decodeRow(db, 'stock_movements', payload);
  insertRow(db, 'stock_movements', row);
  db.prepare('UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?').run(row.quantity, row.product_variant_id);
}

function applyOne(db, record) {
  const { table, uuid, operation, data } = record;
  const cfg = SYNC_TABLES[table];
  if (!cfg) return; // unknown table — ignore defensively, never trust wire data blindly

  if (operation === 'delete') {
    if (!cfg.deletable) return; // not one of the three delete-capable tables — ignore
    db.prepare(`DELETE FROM ${table} WHERE uuid = ?`).run(uuid);
    return;
  }

  if (cfg.kind === 'stock_movement') {
    applyStockMovement(db, uuid, data);
    return;
  }

  if (cfg.kind === 'insert_only') {
    const exists = db.prepare(`SELECT 1 FROM ${table} WHERE uuid = ?`).get(uuid);
    if (exists) return; // immutable + already have it — dedup, never update
    insertRow(db, table, decodeRow(db, table, data));
    return;
  }

  // 'upsert': products, product_variants, product_units, categories,
  // customers, suppliers, users, user_permissions, letterheads,
  // percentage_pricing_rules.
  const row = decodeRow(db, table, data);
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE uuid = ?`).get(uuid);
  if (exists) updateRow(db, table, row);
  else insertRow(db, table, row);
}

// Applies a whole batch inside one transaction, retrying records that hit a
// MissingReferenceError (a parent later in the same array) until a full pass
// makes no further progress. Records that fail for any other reason are
// logged and skipped rather than aborting the rest of the batch — one bad
// record shouldn't block everything else a peer sent.
function applyRecords(db, records) {
  if (!records || !records.length) return { applied: 0, skipped: 0, errors: [] };

  const run = db.transaction((batch) => {
    let remaining = batch;
    let applied = 0;
    const errors = [];
    let madeProgress = true;

    while (remaining.length && madeProgress) {
      madeProgress = false;
      const deferred = [];
      for (const record of remaining) {
        try {
          applyOne(db, record);
          applied += 1;
          madeProgress = true;
        } catch (err) {
          if (err instanceof MissingReferenceError) {
            deferred.push(record);
          } else {
            errors.push({ table: record.table, uuid: record.uuid, message: err.message });
          }
        }
      }
      remaining = deferred;
    }

    for (const record of remaining) {
      errors.push({ table: record.table, uuid: record.uuid, message: 'unresolved reference after full pass' });
    }

    return { applied, skipped: errors.length, errors };
  });

  return run(records);
}

module.exports = { applyRecords };
