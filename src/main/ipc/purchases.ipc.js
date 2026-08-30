const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');

// Records a completed purchase from a supplier — a header row, one line item
// per row, stock incremented (converted to base-unit terms via the line's
// selling unit conversion_factor, same conversion the POS module already uses
// for stock deduction, just adding instead of subtracting), and one
// stock_movements entry per line. All-or-nothing in a single transaction.
// Once submitted, a purchase is permanent — no edit/delete here.
function create({ supplierId, referenceNo, items, createdBy }) {
  const db = getDb();

  if (!supplierId) return { success: false, reason: 'Select a supplier.' };
  if (!items || items.length === 0) return { success: false, reason: 'Add at least one line item.' };

  for (const item of items) {
    if (!item.productVariantId || !item.productUnitId) return { success: false, reason: 'Each line needs a product and unit.' };
    if (!item.quantity || Number(item.quantity) <= 0) return { success: false, reason: 'Quantity must be greater than zero.' };
    if (item.unitCost === undefined || item.unitCost === null || Number(item.unitCost) < 0) {
      return { success: false, reason: 'Enter a valid unit cost.' };
    }
  }

  const run = db.transaction(() => {
    const lineTotals = items.map((item) => Number(item.quantity) * Number(item.unitCost));
    const subtotal = lineTotals.reduce((sum, t) => sum + t, 0);
    const totalAmount = subtotal; // no tax/discount concept for purchases in this build

    const purchaseResult = db
      .prepare(
        `INSERT INTO purchases (supplier_id, reference_no, subtotal, total_amount, created_by, purchase_date)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(supplierId, referenceNo || null, subtotal, totalAmount, createdBy || null);
    const purchaseId = purchaseResult.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO purchase_items (purchase_id, product_id, product_variant_id, quantity, unit_cost, line_total)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const incrementStock = db.prepare(
      `UPDATE product_variants SET stock_qty = stock_qty + ?, last_purchased_at = datetime('now') WHERE id = ?`
    );
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, reference_id)
       VALUES (?, 'purchase', ?, 'purchase', ?)`
    );

    items.forEach((item, i) => {
      const unit = db.prepare('SELECT * FROM product_units WHERE id = ?').get(item.productUnitId);
      if (!unit) throw new Error(`Line ${i + 1}: selling unit not found.`);

      const baseQty = Number(item.quantity) * unit.conversion_factor;

      insertItem.run(purchaseId, unit.product_id, item.productVariantId, Number(item.quantity), Number(item.unitCost), lineTotals[i]);
      incrementStock.run(baseQty, item.productVariantId);
      insertMovement.run(item.productVariantId, baseQty, purchaseId);
    });

    return purchaseId;
  });

  try {
    const purchaseId = run();
    return { success: true, purchaseId };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not complete purchase.' };
  }
}

function registerPurchasesIpc() {
  ipcMain.handle('purchases:create', (event, payload) => create(payload || {}));
}

module.exports = { registerPurchasesIpc };
