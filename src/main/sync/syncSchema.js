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
    // needs_review, created_via (037) sync as plain columns.
    fks: {
      category_id: { table: 'categories', nullable: true },
      supplier_id: { table: 'suppliers', nullable: true },
      merged_into_product_id: { table: 'products', nullable: true }, // 037: quick-added item merged into this one
    },
  },
  product_variants: {
    kind: 'upsert',
    fks: { product_id: { table: 'products' } },
    exclude: ['stock_qty'],
  },
  product_units: {
    kind: 'upsert',
    // pricing_method, trade_price, purchase_discount, extra_discount, sale_discount_c1..c5 sync like any other column.
    fks: { product_id: { table: 'products' } },
  },
  customers: {
    kind: 'upsert',
    // mobile, email, credit_limit, joining_date, notes sync like any other column.
    fks: { assigned_letterhead_id: { table: 'letterheads', nullable: true } },
  },
  suppliers: {
    kind: 'upsert',
    // mobile, email, joining_date sync like any other column.
    fks: { assigned_letterhead_id: { table: 'letterheads', nullable: true } },
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
    kind: 'upsert',
    deletable: true, // bills can be edited (030); since 036 a void is an update (is_voided, voided_at, voided_by)
    fks: {
      customer_id: { table: 'customers', nullable: true },
      cashier_id: { table: 'users' },
      letterhead_id: { table: 'letterheads', nullable: true },
      voided_by: { table: 'users', nullable: true },
    },
  },
  sale_items: {
    kind: 'upsert',
    deletable: true, // bills can be edited (030); since 037 a merge UPDATEs lines (trg_sale_items_au)
    fks: {
      sale_id: { table: 'sales' },
      product_id: { table: 'products' },
      product_variant_id: { table: 'product_variants' },
      product_unit_id: { table: 'product_units' },
    },
  },
  sale_returns: {
    kind: 'insert_only',
    fks: {
      sale_id: { table: 'sales', nullable: true }, // 040: a no-bill return has no sale
      customer_id: { table: 'customers', nullable: true },
      created_by: { table: 'users', nullable: true },
    },
  },
  sale_return_items: {
    kind: 'insert_only',
    fks: {
      return_id: { table: 'sale_returns' },
      sale_item_id: { table: 'sale_items', nullable: true }, // 040: no-bill lines name the Type + pack size instead
      product_variant_id: { table: 'product_variants', nullable: true },
      product_unit_id: { table: 'product_units', nullable: true },
    },
  },
  payments: {
    kind: 'upsert',
    // bills can be edited (030); is_voided (036) syncs as a plain column through trg_payments_au
    deletable: true,
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
  // Rule 12 (038): the approvals log travels like other history (insert-only);
  // the Stock to recount list is upserted (marking an entry counted is an update).
  approvals: {
    kind: 'insert_only',
    fks: {
      sale_id: { table: 'sales', nullable: true },
      cashier_id: { table: 'users', nullable: true },
      admin_id: { table: 'users', nullable: true },
    },
  },
  stock_recount: {
    kind: 'upsert',
    fks: {
      product_variant_id: { table: 'product_variants' },
      sale_id: { table: 'sales', nullable: true },
      created_by: { table: 'users', nullable: true },
      resolved_by: { table: 'users', nullable: true },
    },
  },
  // Rule 14 (039): each successful sale print; any print after the first is a DUPLICATE COPY.
  sale_prints: {
    kind: 'insert_only',
    fks: { sale_id: { table: 'sales' }, printed_by: { table: 'users', nullable: true } },
  },
  stock_movements: {
    kind: 'stock_movement',
    fks: { product_variant_id: { table: 'product_variants' }, created_by: { table: 'users', nullable: true } },
    // reference_type 'adjustment' has no target table at all (reference_id is
    // just NULL for those rows) — see stock.ipc.js.
    polymorphicFk: { column: 'reference_id', typeColumn: 'reference_type', targets: { sale: 'sales', purchase: 'purchases', return: 'sale_returns' } },
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
