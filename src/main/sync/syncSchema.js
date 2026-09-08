// src/main/sync/syncSchema.js
//
// Single source of truth for "how does table X travel between PCs" — every
// other sync module (syncEngine building outgoing payloads, applyIncoming
// resolving them back into local rows) reads this instead of hardcoding
// per-table logic, so adding a new synced table later means editing this
// file only.
//
// Local INTEGER ids never leave a PC (see 022_sync_foundation.sql's PART 1
// comment) — any column that's a foreign key to another synced table is
// listed in `fks` and gets swapped for that table's `uuid` on the wire, then
// resolved back to a local id on the receiving end (see applyIncoming.js).
// `nullable: true` means the FK is optional (e.g. a walk-in sale's
// customer_id) — a null reference is fine, a missing local match for a
// *non-null* reference means the referenced row hasn't arrived/synced yet.
//
// `kind`:
//   'upsert'      — insert if the uuid is new, update in place if it isn't.
//                    Single-writer-per-record in practice (see the prompt's
//                    core insight), so conflicting concurrent edits aren't
//                    expected — applied defensively (last write wins) if
//                    they ever occur anyway.
//   'insert_only' — immutable once created; insert only if the uuid hasn't
//                    been seen before, otherwise a no-op (dedup — the same
//                    record can legitimately arrive twice, e.g. relayed via
//                    a second peer).
//   'stock_movement' — special-cased entirely in applyIncoming.js: dedup by
//                    uuid first, then apply the quantity as a delta to the
//                    variant's stock_qty cache rather than any generic
//                    insert/update path.
//
// `deletable: true` marks the only three tables a delete can ever reach —
// matches the DELETE triggers in 022_sync_foundation.sql exactly.
// `exclude` lists columns that are LOCAL ONLY and never cross the wire in
// either direction — right now just product_variants.stock_qty, which is a
// derived cache (see stock_movements) rather than a raw synced value.
const SYNC_TABLES = {
  categories: {
    kind: 'upsert',
    fks: { parent_id: { table: 'categories', nullable: true } },
  },
  products: {
    kind: 'upsert',
    fks: {
      category_id: { table: 'categories', nullable: true },
      supplier_id: { table: 'suppliers', nullable: true },
    },
  },
  product_variants: {
    kind: 'upsert',
    fks: { product_id: { table: 'products' } },
    exclude: ['stock_qty'],
  },
  product_units: {
    kind: 'upsert',
    fks: { product_id: { table: 'products' } },
  },
  customers: {
    kind: 'upsert',
    fks: { assigned_letterhead_id: { table: 'letterheads', nullable: true } },
  },
  suppliers: {
    kind: 'upsert',
    fks: {},
  },
  users: {
    kind: 'upsert',
    fks: {},
  },
  user_permissions: {
    kind: 'upsert',
    deletable: true,
    fks: { user_id: { table: 'users' } },
  },
  letterheads: {
    kind: 'upsert',
    deletable: true,
    fks: {},
  },
  percentage_pricing_rules: {
    kind: 'upsert',
    deletable: true,
    fks: {
      product_id: { table: 'products' },
      customer_id: { table: 'customers', nullable: true },
    },
  },
  sales: {
    kind: 'insert_only',
    fks: {
      customer_id: { table: 'customers', nullable: true },
      cashier_id: { table: 'users' },
      letterhead_id: { table: 'letterheads', nullable: true },
    },
  },
  sale_items: {
    kind: 'insert_only',
    fks: {
      sale_id: { table: 'sales' },
      product_id: { table: 'products' },
      product_variant_id: { table: 'product_variants' },
      product_unit_id: { table: 'product_units' },
    },
  },
  payments: {
    kind: 'insert_only',
    fks: { sale_id: { table: 'sales', nullable: true }, received_by: { table: 'users', nullable: true } },
    polymorphicFk: { column: 'party_id', typeColumn: 'party_type', targets: { customer: 'customers', supplier: 'suppliers' } },
  },
  purchases: {
    kind: 'insert_only',
    fks: { supplier_id: { table: 'suppliers' }, created_by: { table: 'users', nullable: true } },
  },
  purchase_items: {
    kind: 'insert_only',
    fks: {
      purchase_id: { table: 'purchases' },
      product_id: { table: 'products' },
      product_variant_id: { table: 'product_variants' },
    },
  },
  ledger_adjustments: {
    kind: 'insert_only',
    fks: { created_by: { table: 'users', nullable: true } },
    polymorphicFk: { column: 'party_id', typeColumn: 'party_type', targets: { customer: 'customers', supplier: 'suppliers' } },
  },
  stock_movements: {
    kind: 'stock_movement',
    fks: { product_variant_id: { table: 'product_variants' }, created_by: { table: 'users', nullable: true } },
    // reference_type 'adjustment' has no target table at all (reference_id is
    // just NULL for those rows) — see stock.ipc.js.
    polymorphicFk: { column: 'reference_id', typeColumn: 'reference_type', targets: { sale: 'sales', purchase: 'purchases' } },
  },
};

// Honest limitation, not solved by this build: letterheads.pdf_template_path
// (and image_path) point at a file under THIS PC's own userData folder
// (see letterheads.ipc.js). Syncing the row moves the path string, not the
// file — a Cashier PC will have a letterhead row pointing at a path that
// doesn't exist on its own disk until someone manually copies the file over.
// Worth revisiting (e.g. shipping the file bytes alongside the row) if
// letterhead-per-station printing becomes a real workflow.

const tableColumnCache = new Map();

function getTableColumns(db, table) {
  if (!tableColumnCache.has(table)) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    tableColumnCache.set(table, new Set(cols));
  }
  return tableColumnCache.get(table);
}

function isSyncedTable(table) {
  return Object.prototype.hasOwnProperty.call(SYNC_TABLES, table);
}

module.exports = { SYNC_TABLES, getTableColumns, isSyncedTable };
