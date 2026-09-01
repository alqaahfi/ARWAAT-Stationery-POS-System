const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');

// Shown next to whatever the admin types in the Note field — keeps a short,
// consistent label on every adjustment row even when Note is left blank.
const REASON_LABELS = {
  damaged: 'Damaged / Broken',
  expired: 'Expired',
  lost: 'Lost / Stolen',
  recount: 'Stock Recount Correction',
  other: 'Other',
};

// ---------------- Stock Adjustments ----------------

// Manual +/- correction to a single variant's stock_qty — the one path
// (besides purchases and sales) allowed to touch stock_qty directly. Always
// paired with a stock_movements row so it shows up in Movement History too.
function adjustStock({ productVariantId, direction, quantity, reasonCode, note, createdBy }) {
  const db = getDb();

  if (!productVariantId) return { success: false, reason: 'Select a product and variant.' };
  if (!['increase', 'decrease'].includes(direction)) return { success: false, reason: 'Choose Increase or Decrease.' };
  const qty = Number(quantity);
  if (!qty || qty <= 0) return { success: false, reason: 'Enter a quantity greater than zero.' };
  if (!REASON_LABELS[reasonCode]) return { success: false, reason: 'Select a reason.' };

  const variant = db
    .prepare(
      `SELECT pv.id, pv.stock_qty, pv.variant_name, p.name AS product_name
       FROM product_variants pv JOIN products p ON p.id = pv.product_id
       WHERE pv.id = ?`
    )
    .get(productVariantId);
  if (!variant) return { success: false, reason: 'Product variant not found.' };

  const signedQty = direction === 'increase' ? qty : -qty;
  if (direction === 'decrease' && qty > variant.stock_qty) {
    return {
      success: false,
      reason: `Cannot remove ${qty} — only ${variant.stock_qty} currently in stock for ${variant.product_name} (${variant.variant_name}).`,
    };
  }

  const reasonLabel = REASON_LABELS[reasonCode];
  const fullNote = note && note.trim() ? `${reasonLabel} — ${note.trim()}` : reasonLabel;

  const run = db.transaction(() => {
    db.prepare('UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?').run(signedQty, productVariantId);
    db.prepare(
      `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, note, created_by)
       VALUES (?, 'adjustment', ?, 'adjustment', ?, ?)`
    ).run(productVariantId, signedQty, fullNote, createdBy || null);
  });
  run();

  const newStock = db.prepare('SELECT stock_qty FROM product_variants WHERE id = ?').get(productVariantId).stock_qty;
  return { success: true, newStock };
}

// ---------------- Stock Movement History ----------------
// Read-only log over stock_movements — already populated by every purchase,
// sale and adjustment; this just joins in enough context (product/variant
// name, who recorded it, and the originating purchase/sale reference) to
// render a useful table. Capped at 500 rows — narrow the filters for older
// history rather than paging through the whole audit trail.
const MOVEMENT_ROW_LIMIT = 500;

function getMovements(filters = {}) {
  const db = getDb();
  const { productId, movementType, dateFrom, dateTo, search } = filters;

  const rows = db
    .prepare(
      `SELECT sm.id, sm.movement_type, sm.quantity, sm.reference_type, sm.reference_id, sm.note, sm.created_at,
              p.id AS product_id, p.name AS product_name, p.base_unit_name,
              pv.id AS variant_id, pv.variant_name,
              u.full_name AS created_by_name,
              pur.reference_no AS purchase_reference_no,
              sa.invoice_no AS sale_invoice_no
       FROM stock_movements sm
       JOIN product_variants pv ON pv.id = sm.product_variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN users u ON u.id = sm.created_by
       LEFT JOIN purchases pur ON sm.reference_type = 'purchase' AND pur.id = sm.reference_id
       LEFT JOIN sales sa ON sm.reference_type = 'sale' AND sa.id = sm.reference_id
       WHERE (@productId IS NULL OR p.id = @productId)
         AND (@movementType IS NULL OR sm.movement_type = @movementType)
         AND (@dateFrom IS NULL OR date(sm.created_at) >= date(@dateFrom))
         AND (@dateTo IS NULL OR date(sm.created_at) <= date(@dateTo))
         AND (@likeTerm IS NULL OR p.name LIKE @likeTerm OR p.sku LIKE @likeTerm)
       ORDER BY sm.created_at DESC, sm.id DESC
       LIMIT ${MOVEMENT_ROW_LIMIT}`
    )
    .all({
      productId: productId || null,
      movementType: movementType || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      likeTerm: search && search.trim() ? `%${search.trim()}%` : null,
    });

  return { rows, limit: MOVEMENT_ROW_LIMIT };
}

function registerStockIpc() {
  ipcMain.handle('stock:get-adjustment-reasons', () =>
    Object.entries(REASON_LABELS).map(([code, label]) => ({ code, label }))
  );
  ipcMain.handle('stock:adjust', (event, payload) => adjustStock(payload || {}));
  ipcMain.handle('stock:get-movements', (event, payload) => getMovements(payload || {}));
}

module.exports = { registerStockIpc };
