// Rule 11: "Add missing items at the counter".
//
// quickAdd()     — the counter creates a real product on the spot: name, optional
//                  unique barcode, retail price > 0. It gets one "Piece" pack size
//                  (retail = wholesale = that price, buying price unknown) and is
//                  flagged needs_review. It can be sold with no stock (stock goes negative).
// findSimilar()  — products whose name looks like the typed one, so the cashier can
//                  pick the real item instead of creating a duplicate.
// listNeedsReview / approve / merge — the Admin's "Needs review" list.
const { getDb } = require('../db/connection');
const { logActivity } = require('../activity/activityLog');

const MAX_PRICE = 10_000_000;

function cleanBarcode(value) {
  return String(value ?? '').replace(/[\r\n\t]/g, '').trim();
}

function findSimilar({ name } = {}) {
  const db = getDb();
  const text = String(name || '').trim();
  if (text.length < 2) return { success: true, matches: [] };
  const words = text.split(/\s+/).filter((w) => w.length >= 3).slice(0, 4);
  const terms = [text, ...words];
  const where = terms.map(() => '(p.name LIKE ? OR p.search_alias LIKE ?)').join(' OR ');
  const params = terms.flatMap((w) => [`%${w}%`, `%${w}%`]);
  const rows = db
    .prepare(
      `SELECT p.id AS productId, p.name, p.needs_review,
              (SELECT pv.id FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1 ORDER BY pv.id LIMIT 1) AS variantId,
              (SELECT pu.retail_price FROM product_units pu WHERE pu.product_id = p.id AND pu.is_active = 1
                 ORDER BY pu.is_default_sale_unit DESC, pu.id LIMIT 1) AS retailPrice
       FROM products p
       WHERE p.is_active = 1 AND (${where})
       ORDER BY (lower(p.name) = lower(?)) DESC, p.name
       LIMIT 5`
    )
    .all(...params, text);
  return { success: true, matches: rows.filter((r) => r.variantId) };
}

function quickAdd({ barcode, name, retailPrice, createdBy } = {}) {
  const db = getDb();
  const cleanName = String(name || '').trim();
  if (!cleanName) return { success: false, reason: 'Type the item name.' };
  if (cleanName.length > 200) return { success: false, reason: 'The name is too long (200 letters at most).' };
  const price = Number(retailPrice);
  if (!Number.isFinite(price) || price <= 0) return { success: false, reason: 'Type a selling price above zero.' };
  if (price > MAX_PRICE) return { success: false, reason: 'That price is too high. Check the number.' };
  const code = cleanBarcode(barcode);
  if (code) {
    const taken = db
      .prepare(
        `SELECT p.name FROM product_variants pv JOIN products p ON p.id = pv.product_id
         WHERE pv.barcode = ? COLLATE NOCASE`
      )
      .get(code);
    if (taken) return { success: false, barcodeTaken: true, reason: `That barcode already belongs to "${taken.name}".` };
  }
  const roundedPrice = Math.round(price * 100) / 100;

  const run = db.transaction(() => {
    const productId = db
      .prepare(
        `INSERT INTO products (name, base_unit_name, min_stock_alert, pricing_type, is_agency_item, is_active, needs_review, created_via)
         VALUES (?, 'Piece', 0, 'fixed', 0, 1, 1, 'quick_add')`
      )
      .run(cleanName).lastInsertRowid;
    const variantId = db
      .prepare(`INSERT INTO product_variants (product_id, variant_name, barcode, stock_qty) VALUES (?, 'Standard', ?, 0)`)
      .run(productId, code || null).lastInsertRowid;
    const unitId = db
      .prepare(
        `INSERT INTO product_units (product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, is_default_sale_unit)
         VALUES (?, 'Piece', 1, ?, ?, 0, 1)`
      )
      .run(productId, roundedPrice, roundedPrice).lastInsertRowid;
    return { productId, variantId, unitId };
  });

  try {
    const out = run();
    if (createdBy) {
      logActivity(db, { userId: createdBy, action: 'item_quick_added', description: `Added missing item "${cleanName}" at ${roundedPrice}`, referenceType: 'product', referenceId: out.productId });
    }
    return { success: true, ...out };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'That barcode is already in use.' };
    return { success: false, reason: 'Could not add the item.' };
  }
}

function listNeedsReview() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.created_at, p.category_id,
              (SELECT GROUP_CONCAT(pv.barcode, ', ') FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1 AND pv.barcode IS NOT NULL) AS barcode,
              (SELECT COALESCE(SUM(pv.stock_qty), 0) FROM product_variants pv WHERE pv.product_id = p.id AND pv.is_active = 1) AS stock,
              (SELECT pu.retail_price FROM product_units pu WHERE pu.product_id = p.id AND pu.is_active = 1 ORDER BY pu.is_default_sale_unit DESC, pu.id LIMIT 1) AS retail_price,
              (SELECT MIN(pu.cost_price) FROM product_units pu WHERE pu.product_id = p.id AND pu.is_active = 1) AS min_cost,
              (SELECT COALESCE(SUM(si.quantity + si.foc_quantity), 0) FROM sale_items si JOIN sales s ON s.id = si.sale_id
                 WHERE si.product_id = p.id AND s.is_voided = 0) AS sold_qty
       FROM products p
       WHERE p.needs_review = 1 AND p.is_active = 1
       ORDER BY p.created_at DESC, p.id DESC`
    )
    .all();
  return { success: true, rows: rows.map((r) => ({ ...r, buyingPriceMissing: !(Number(r.min_cost) > 0) })) };
}

function countNeedsReview(db = getDb()) {
  return db.prepare('SELECT COUNT(*) AS n FROM products WHERE needs_review = 1 AND is_active = 1').get().n;
}

// Approve: only once every pack size has a buying price (that is the point of the review).
function approve({ productId } = {}) {
  const db = getDb();
  const p = db.prepare('SELECT id, name, needs_review FROM products WHERE id = ?').get(productId);
  if (!p) return { success: false, reason: 'That item no longer exists.' };
  if (!p.needs_review) return { success: false, reason: 'This item was already reviewed.' };
  const missing = db
    .prepare('SELECT COUNT(*) AS n FROM product_units WHERE product_id = ? AND is_active = 1 AND (cost_price IS NULL OR cost_price <= 0)')
    .get(productId).n;
  if (missing) return { success: false, reason: 'Set the buying price first (Edit the item), then approve it.' };
  db.prepare("UPDATE products SET needs_review = 0, updated_at = datetime('now') WHERE id = ?").run(productId);
  return { success: true };
}

// Merge a quick-added item into an existing product: its sale lines move to the
// chosen Type + pack size (same number of pieces per pack), its stock moves across
// as two stock movements (so other PCs apply the same change), then it is
// deactivated and remembers where it went.
function merge({ productId, intoVariantId, intoUnitId, userId } = {}) {
  const db = getDb();
  const src = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!src) return { success: false, reason: 'That item no longer exists.' };
  if (!src.needs_review || !src.is_active) return { success: false, reason: 'Only items waiting for review can be merged.' };
  const target = db
    .prepare(
      `SELECT pv.id AS variant_id, pv.product_id, p.name, p.is_active AS p_active, pv.is_active AS v_active
       FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = ?`
    )
    .get(intoVariantId);
  if (!target || !target.p_active || !target.v_active) return { success: false, reason: 'Choose the product to merge into.' };
  if (target.product_id === src.id) return { success: false, reason: 'An item cannot be merged into itself.' };
  const unit = db.prepare('SELECT * FROM product_units WHERE id = ? AND product_id = ? AND is_active = 1').get(intoUnitId, target.product_id);
  if (!unit) return { success: false, reason: 'Choose a pack size of that product.' };
  const srcUnits = db.prepare('SELECT DISTINCT pu.conversion_factor AS f FROM sale_items si JOIN product_units pu ON pu.id = si.product_unit_id WHERE si.product_id = ?').all(src.id);
  if (srcUnits.some((u) => u.f !== unit.conversion_factor)) {
    return { success: false, reason: `Choose a pack size with the same number of pieces (${srcUnits.map((u) => u.f).join(', ')}).` };
  }

  const run = db.transaction(() => {
    db.prepare('UPDATE sale_items SET product_id = ?, product_variant_id = ?, product_unit_id = ? WHERE product_id = ?')
      .run(target.product_id, target.variant_id, unit.id, src.id);
    db.prepare('UPDATE purchase_items SET product_id = ?, product_variant_id = ? WHERE product_id = ?')
      .run(target.product_id, target.variant_id, src.id);
    const variants = db.prepare('SELECT id, stock_qty FROM product_variants WHERE product_id = ?').all(src.id);
    const move = db.prepare(
      `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, note, created_by)
       VALUES (?, 'adjustment', ?, 'adjustment', ?, ?)`
    );
    let moved = 0;
    for (const v of variants) {
      if (!v.stock_qty) continue;
      move.run(v.id, -v.stock_qty, `Merged into ${target.name}`, userId || null);
      db.prepare('UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ?').run(v.stock_qty, v.id);
      moved += v.stock_qty;
    }
    if (moved) {
      move.run(target.variant_id, moved, `Merged from ${src.name}`, userId || null);
      db.prepare('UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?').run(moved, target.variant_id);
    }
    // The item's barcode moves to the real product when that Type has none yet (so the next scan
    // finds it); a deactivated item never keeps a barcode, which would block reusing it.
    const codes = db.prepare('SELECT barcode FROM product_variants WHERE product_id = ? AND barcode IS NOT NULL').all(src.id).map((r) => r.barcode);
    db.prepare('UPDATE product_variants SET is_active = 0, barcode = NULL WHERE product_id = ?').run(src.id);
    const targetCode = db.prepare('SELECT barcode FROM product_variants WHERE id = ?').get(target.variant_id).barcode;
    if (!targetCode && codes.length === 1) db.prepare('UPDATE product_variants SET barcode = ? WHERE id = ?').run(codes[0], target.variant_id);
    db.prepare(
      "UPDATE products SET is_active = 0, needs_review = 0, merged_into_product_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(target.product_id, src.id);
    db.prepare(
      `UPDATE product_variants SET last_sold_at = (
         SELECT MAX(s.created_at) FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE si.product_variant_id = product_variants.id AND s.is_voided = 0) WHERE id = ?`
    ).run(target.variant_id);
    return { movedStock: moved };
  });
  try {
    return { success: true, ...run() };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not merge the item.' };
  }
}

module.exports = { quickAdd, findSimilar, listNeedsReview, countNeedsReview, approve, merge, cleanBarcode };
