const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { withCallerId } = require('../security/ipcGuard');
const { getProductStockStatus } = require('../db/models/Product');

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
              sa.invoice_no AS sale_invoice_no,
              sr.return_no AS return_no
       FROM stock_movements sm
       JOIN product_variants pv ON pv.id = sm.product_variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN users u ON u.id = sm.created_by
       LEFT JOIN purchases pur ON sm.reference_type = 'purchase' AND pur.id = sm.reference_id
       LEFT JOIN sales sa ON sm.reference_type = 'sale' AND sa.id = sm.reference_id
       LEFT JOIN sale_returns sr ON sm.reference_type = 'return' AND sr.id = sm.reference_id
       WHERE (@productId IS NULL OR p.id = @productId)
         AND (@movementType IS NULL OR sm.movement_type = @movementType)
         AND (@dateFrom IS NULL OR date(sm.created_at) >= date(@dateFrom))
         AND (@dateTo IS NULL OR date(sm.created_at) <= date(@dateTo))
         AND (@likeTerm IS NULL OR p.name LIKE @likeTerm OR p.search_alias LIKE @likeTerm OR p.sku LIKE @likeTerm)
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

// ---------------- Add / Delete Stock (multi-line forms) ----------------
// One transaction per submit: every line moves stock_qty and writes its own
// stock_movements row (type 'adjustment'; the note says Stock added / removed).

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function loadLine(db, line) {
  const variant = db
    .prepare(
      `SELECT pv.id, pv.stock_qty, pv.variant_name, pv.product_id, p.name AS product_name
       FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ?`
    )
    .get(line.variantId);
  if (!variant) return { error: 'One of the products could not be found.' };
  const unit = db.prepare('SELECT * FROM product_units WHERE id = ? AND product_id = ? AND is_active = 1').get(line.unitId, variant.product_id);
  if (!unit) return { error: `Pack size not found for ${variant.product_name}.` };
  const qty = Number(line.quantity);
  if (!qty || qty <= 0) return { error: `Enter a quantity greater than zero for ${variant.product_name}.` };
  return { variant, unit, qty, baseQty: qty * unit.conversion_factor };
}

// Buying-price changes typed on the form are written back to the pack size.
// Trade Price packs keep retail / wholesale / special rates in step with the
// trade price, exactly as the product form does.
function applyPricing(db, unit, pricing) {
  if (!pricing) return;
  if (unit.pricing_method === 'trade') {
    const trade = Math.max(0, Number(pricing.tradePrice) || 0);
    const pct = Math.max(0, Number(pricing.purchaseDiscount) || 0);
    const extra = Math.max(0, Number(pricing.extraDiscount) || 0);
    const cost = Math.max(0, round2(trade - (trade * pct) / 100 - extra));
    const sets = ['trade_price = ?', 'purchase_discount = ?', 'extra_discount = ?', 'cost_price = ?'];
    const vals = [trade, pct, extra, cost];
    if (trade !== unit.trade_price) {
      sets.push('retail_price = ?', 'wholesale_price = ?');
      vals.push(trade, trade);
      for (let n = 1; n <= 5; n++) {
        const d = unit[`sale_discount_c${n}`];
        if (d !== null && d !== undefined) {
          sets.push(`net_rate_c${n} = ?`);
          vals.push(Math.max(0, round2(trade - (trade * d) / 100)));
        }
      }
    }
    db.prepare(`UPDATE product_units SET ${sets.join(', ')} WHERE id = ?`).run(...vals, unit.id);
  } else {
    const cost = Math.max(0, Number(pricing.unitPrice) || 0);
    if (cost !== unit.cost_price) db.prepare('UPDATE product_units SET cost_price = ? WHERE id = ?').run(cost, unit.id);
  }
}

function addStock({ lines, note, createdBy, updatePrices }) {
  const db = getDb();
  if (!Array.isArray(lines) || !lines.length) return { success: false, reason: 'Add at least one product.' };
  const loaded = [];
  for (const line of lines) {
    const l = loadLine(db, line);
    if (l.error) return { success: false, reason: l.error };
    loaded.push({ ...l, pricing: line.pricing });
  }

  db.transaction(() => {
    for (const l of loaded) {
      db.prepare("UPDATE product_variants SET stock_qty = stock_qty + ?, last_purchased_at = datetime('now') WHERE id = ?").run(l.baseQty, l.variant.id);
      const text = `Stock added: ${l.qty} × ${l.unit.unit_name}`;
      db.prepare(
        `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, note, created_by)
         VALUES (?, 'adjustment', ?, 'stock_in', ?, ?)`
      ).run(l.variant.id, l.baseQty, note && note.trim() ? `${text} — ${note.trim()}` : text, createdBy || null);
      if (updatePrices !== false) applyPricing(db, l.unit, l.pricing);
    }
  })();
  return { success: true, count: loaded.length };
}

function removeStock({ lines, reasonCode, note, createdBy }) {
  const db = getDb();
  if (!Array.isArray(lines) || !lines.length) return { success: false, reason: 'Add at least one product.' };
  if (!REASON_LABELS[reasonCode]) return { success: false, reason: 'Select a reason.' };
  const loaded = [];
  const totals = new Map();
  for (const line of lines) {
    const l = loadLine(db, line);
    if (l.error) return { success: false, reason: l.error };
    loaded.push(l);
    totals.set(l.variant.id, (totals.get(l.variant.id) || 0) + l.baseQty);
  }
  for (const l of loaded) {
    if (totals.get(l.variant.id) > l.variant.stock_qty + 1e-9) {
      return { success: false, reason: `Cannot remove that much — only ${l.variant.stock_qty} in stock for ${l.variant.product_name} (${l.variant.variant_name}).` };
    }
  }

  const label = REASON_LABELS[reasonCode];
  db.transaction(() => {
    for (const l of loaded) {
      db.prepare('UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ?').run(l.baseQty, l.variant.id);
      const text = `Stock removed (${label}): ${l.qty} × ${l.unit.unit_name}`;
      db.prepare(
        `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, note, created_by)
         VALUES (?, 'adjustment', ?, 'stock_out', ?, ?)`
      ).run(l.variant.id, -l.baseQty, note && note.trim() ? `${text} — ${note.trim()}` : text, createdBy || null);
    }
  })();
  return { success: true, count: loaded.length };
}

// Sales figures for the Product Profile (quantities in base units).
function getProductStats(productId) {
  const db = getDb();
  const sold = db
    .prepare(
      `SELECT COALESCE(SUM((si.quantity + si.foc_quantity) * pu.conversion_factor), 0) AS base_qty,
              COALESCE(SUM(si.line_total), 0) AS revenue,
              COALESCE(SUM((si.quantity + si.foc_quantity) * pu.cost_price), 0) AS cogs,
              COUNT(DISTINCT si.sale_id) AS sales_count,
              MAX(s.created_at) AS last_sold_at
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN product_units pu ON pu.id = si.product_unit_id
       WHERE si.product_id = ?`
    )
    .get(productId);
  const last30 = db
    .prepare(
      `SELECT COALESCE(SUM((si.quantity + si.foc_quantity) * pu.conversion_factor), 0) AS base_qty,
              COALESCE(SUM(si.line_total), 0) AS revenue
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN product_units pu ON pu.id = si.product_unit_id
       WHERE si.product_id = ? AND s.created_at >= datetime('now', '-30 days')`
    )
    .get(productId);
  const lastPurchased = db.prepare('SELECT MAX(last_purchased_at) AS at FROM product_variants WHERE product_id = ?').get(productId);
  const info = db
    .prepare(
      `SELECT p.min_stock_alert, p.dead_stock_days, c.name AS category_name, s.name AS supplier_name,
              COALESCE(SUM(pv.stock_qty), 0) AS total_stock,
              CAST(julianday('now') - julianday(COALESCE(MAX(pv.last_sold_at), p.created_at)) AS INTEGER) AS days_since_last_sale
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
       WHERE p.id = ? GROUP BY p.id`
    )
    .get(productId);
  return {
    success: true,
    categoryName: info?.category_name || null,
    supplierName: info?.supplier_name || null,
    totalStock: info?.total_stock || 0,
    ...(info ? getProductStockStatus(info) : { isOutOfStock: false, isLow: false, isDead: false }),
    soldBaseQty: sold.base_qty,
    revenue: round2(sold.revenue),
    profit: round2(sold.revenue - sold.cogs),
    salesCount: sold.sales_count,
    lastSoldAt: sold.last_sold_at,
    last30BaseQty: last30.base_qty,
    last30Revenue: round2(last30.revenue),
    lastPurchasedAt: lastPurchased?.at || null,
  };
}

function registerStockIpc() {
  ipcMain.handle('stock:get-adjustment-reasons', () =>
    Object.entries(REASON_LABELS).map(([code, label]) => ({ code, label }))
  );
  ipcMain.handle('stock:add', (event, payload) => addStock(withCallerId(event, payload, 'createdBy')));
  ipcMain.handle('stock:remove', (event, payload) => removeStock(withCallerId(event, payload, 'createdBy')));
  ipcMain.handle('stock:get-product-stats', (event, { productId } = {}) => getProductStats(productId));
  ipcMain.handle('stock:adjust', (event, payload) => adjustStock(withCallerId(event, payload, 'createdBy')));
  ipcMain.handle('stock:get-movements', (event, payload) => getMovements(payload || {}));
}

module.exports = { registerStockIpc };
