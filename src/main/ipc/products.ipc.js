const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const ProductModel = require('../db/models/Product');

// ---------- shared validation / normalization ----------

// Ensures there's at least one variant (auto-creates 'Standard' if the form
// submitted none — the Product Form UI calls this the product's own top-level
// "Barcode"/"Starting Stock" fields, shown only while zero Types exist)
// and exactly one default sale unit (auto-picks the first).
// standardVariantId, when present, is an existing product_variants.id to
// update in place (preserving its stock_qty/history) rather than replacing —
// set when editing a product that's still in single-item ("no Types") mode.
function normalizeVariantsAndUnits(variants, units, standardStartingStock, standardBarcode, standardVariantId) {
  const normalizedVariants =
    variants && variants.length > 0
      ? variants
      : [
          {
            id: standardVariantId || undefined,
            variantName: 'Standard',
            barcode: standardBarcode || null,
            startingStock: Number(standardStartingStock) || 0,
          },
        ];

  if (!units || units.length === 0) {
    return { error: 'At least one selling unit is required.' };
  }

  let normalizedUnits = units;
  if (!normalizedUnits.some((u) => u.isDefaultSaleUnit)) {
    normalizedUnits = normalizedUnits.map((u, i) => ({ ...u, isDefaultSaleUnit: i === 0 }));
  }

  return { variants: normalizedVariants, units: normalizedUnits };
}

function isSkuTaken(db, sku, excludeId) {
  if (!sku) return false;
  const row = excludeId
    ? db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(sku, excludeId)
    : db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
  return !!row;
}

function isBarcodeTaken(db, barcode, excludeVariantId) {
  if (!barcode) return false;
  const row = excludeVariantId
    ? db.prepare('SELECT id FROM product_variants WHERE barcode = ? AND id != ?').get(barcode, excludeVariantId)
    : db.prepare('SELECT id FROM product_variants WHERE barcode = ?').get(barcode);
  return !!row;
}

// ---------- All Products list: filters + sort resolved in SQL ----------

const SORT_COLUMNS = {
  name: 'p.name',
  total_stock: 'total_stock',
  category: 'category_name',
  created_at: 'p.created_at',
  updated_at: 'p.updated_at',
};

// Shared by the rows query and the counts query below — both need the exact
// same filtered/grouped set, just aggregated differently. days_since_last_sale
// mirrors ProductModel.getDeadStock's own formula so a product's dead-stock
// status is computed identically everywhere.
function buildFilteredQuery() {
  return `
    SELECT p.id, p.name, p.sku, p.base_unit_name, p.min_stock_alert, p.dead_stock_days,
           p.is_active, p.category_id, p.created_at, p.updated_at,
           c.name AS category_name,
           COALESCE(SUM(pv.stock_qty), 0) AS total_stock,
           COUNT(DISTINCT pv.id) AS variant_count,
           (SELECT COUNT(*) FROM product_units pu WHERE pu.product_id = p.id AND pu.is_active = 1) AS unit_count,
           MAX(pv.last_sold_at) AS last_sold_at,
           CAST(julianday('now') - julianday(COALESCE(MAX(pv.last_sold_at), p.created_at)) AS INTEGER) AS days_since_last_sale
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = 1
    WHERE (@likeTerm IS NULL OR p.name LIKE @likeTerm OR p.sku LIKE @likeTerm)
      AND (@categoryId IS NULL OR p.category_id = @categoryId)
      AND (
        @activeFilter = 'all'
        OR (@activeFilter = 'active' AND p.is_active = 1)
        OR (@activeFilter = 'inactive' AND p.is_active = 0)
      )
    GROUP BY p.id
  `;
}

function list(filters = {}) {
  const db = getDb();
  const { search, categoryId, lowStockOnly, deadStockOnly, outOfStockOnly, activeFilter, sortBy, sortDirection } = filters;

  const params = {
    likeTerm: search ? `%${search}%` : null,
    categoryId: categoryId || null,
    activeFilter: activeFilter || 'all',
  };

  const baseQuery = buildFilteredQuery();

  const havingClauses = [];
  if (outOfStockOnly) havingClauses.push('total_stock = 0');
  else if (lowStockOnly) havingClauses.push('total_stock <= p.min_stock_alert');
  if (deadStockOnly) havingClauses.push('(p.dead_stock_days IS NOT NULL AND days_since_last_sale >= p.dead_stock_days)');
  const havingSql = havingClauses.length ? `HAVING ${havingClauses.join(' AND ')}` : '';

  const sortColumn = SORT_COLUMNS[sortBy] || SORT_COLUMNS.name;
  const direction = sortDirection === 'desc' ? 'DESC' : 'ASC';

  const rows = db.prepare(`${baseQuery} ${havingSql} ORDER BY ${sortColumn} ${direction}`).all(params);

  // Status flags computed once here (shared logic, see Product.js) so the
  // renderer never has to re-derive them — just render what's on the row.
  const rowsWithStatus = rows.map((row) => ({ ...row, ...ProductModel.getProductStockStatus(row) }));

  // Chip counts reflect the current search/category/active filters but NOT
  // the status toggles themselves, so clicking between chips stays meaningful.
  const countsRow = db
    .prepare(
      `SELECT
         COUNT(*) AS all_count,
         SUM(CASE WHEN total_stock = 0 THEN 1 ELSE 0 END) AS out_of_stock_count,
         SUM(CASE WHEN total_stock > 0 AND total_stock <= min_stock_alert THEN 1 ELSE 0 END) AS low_count,
         SUM(CASE WHEN dead_stock_days IS NOT NULL AND days_since_last_sale >= dead_stock_days THEN 1 ELSE 0 END) AS dead_count
       FROM (${baseQuery})`
    )
    .get(params);

  return {
    rows: rowsWithStatus,
    counts: {
      all: countsRow.all_count || 0,
      lowStock: countsRow.low_count || 0,
      deadStock: countsRow.dead_count || 0,
      outOfStock: countsRow.out_of_stock_count || 0,
    },
  };
}

function getById(id) {
  const db = getDb();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return null;

  const variants = db
    .prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY id')
    .all(id);
  const units = db
    .prepare('SELECT * FROM product_units WHERE product_id = ? AND is_active = 1 ORDER BY id')
    .all(id);

  return { ...product, variants, units };
}

// ---------- create ----------

function create(payload) {
  const db = getDb();
  const {
    name, sku, companyName, categoryId, supplierId, baseUnitName, isActive, notes,
    minStockAlert, deadStockDays, pricingType, defaultPercentage, isAgencyItem,
    variants, units, standardStartingStock, standardBarcode,
  } = payload;

  if (!name || !name.trim()) return { success: false, reason: 'Product name is required.' };
  if (isSkuTaken(db, sku)) return { success: false, reason: 'That SKU is already in use.' };

  const normalized = normalizeVariantsAndUnits(variants, units, standardStartingStock, standardBarcode);
  if (normalized.error) return { success: false, reason: normalized.error };

  for (const v of normalized.variants) {
    if (isBarcodeTaken(db, v.barcode)) {
      return { success: false, reason: `Barcode "${v.barcode}" is already assigned to another variant.` };
    }
  }

  const run = db.transaction(() => {
    const productResult = db
      .prepare(
        `INSERT INTO products
           (name, sku, company_name, category_id, supplier_id, base_unit_name, min_stock_alert,
            dead_stock_days, pricing_type, default_percentage, is_agency_item, notes, is_active)
         VALUES (@name, @sku, @companyName, @categoryId, @supplierId, @baseUnitName, @minStockAlert,
                 @deadStockDays, @pricingType, @defaultPercentage, @isAgencyItem, @notes, @isActive)`
      )
      .run({
        name: name.trim(),
        sku: sku || null,
        companyName: companyName || null,
        categoryId: categoryId || null,
        supplierId: supplierId || null,
        baseUnitName: baseUnitName || 'Piece',
        minStockAlert: Number(minStockAlert) || 0,
        deadStockDays: deadStockDays || null,
        // Product Form no longer exposes Pricing Type/Default Percentage —
        // every product created there defaults to fixed pricing; percentage
        // pricing is configured entirely via Percentage Pricing Rules now.
        pricingType: pricingType === 'percentage' ? 'percentage' : 'fixed',
        defaultPercentage: pricingType === 'percentage' ? Number(defaultPercentage) || 0 : null,
        isAgencyItem: isAgencyItem ? 1 : 0,
        notes: notes || null,
        isActive: isActive === false ? 0 : 1,
      });

    const productId = productResult.lastInsertRowid;

    const insertVariant = db.prepare(
      `INSERT INTO product_variants (product_id, variant_name, barcode, stock_qty)
       VALUES (?, ?, ?, ?)`
    );
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, note)
       VALUES (?, 'purchase', ?, 'initial_stock', 'Initial stock on product creation')`
    );

    for (const v of normalized.variants) {
      const startingStock = Number(v.startingStock) || 0;
      const variantResult = insertVariant.run(productId, v.variantName || 'Standard', v.barcode || null, startingStock);
      if (startingStock > 0) {
        insertMovement.run(variantResult.lastInsertRowid, startingStock);
      }
    }

    const insertUnit = db.prepare(
      `INSERT INTO product_units
         (product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, is_default_sale_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const u of normalized.units) {
      insertUnit.run(
        productId,
        u.unitName,
        Number(u.conversionFactor) || 1,
        Number(u.retailPrice) || 0,
        Number(u.wholesalePrice) || 0,
        Number(u.costPrice) || 0,
        u.isDefaultSaleUnit ? 1 : 0
      );
    }

    return productId;
  });

  try {
    const id = run();
    return { success: true, id };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'A product with that SKU or a variant barcode already exists.' };
    return { success: false, reason: 'Could not save product.' };
  }
}

// ---------- update (diffs variants/units against what's already stored) ----------

function update(payload) {
  const db = getDb();
  const {
    id, name, sku, companyName, categoryId, supplierId, baseUnitName, isActive, notes,
    minStockAlert, deadStockDays, pricingType, defaultPercentage, isAgencyItem,
    variants, units, standardStartingStock, standardBarcode, standardVariantId,
  } = payload;

  if (!name || !name.trim()) return { success: false, reason: 'Product name is required.' };
  if (isSkuTaken(db, sku, id)) return { success: false, reason: 'That SKU is already in use.' };

  const normalized = normalizeVariantsAndUnits(variants, units, standardStartingStock, standardBarcode, standardVariantId);
  if (normalized.error) return { success: false, reason: normalized.error };

  for (const v of normalized.variants) {
    if (isBarcodeTaken(db, v.barcode, v.id)) {
      return { success: false, reason: `Barcode "${v.barcode}" is already assigned to another variant.` };
    }
  }

  // The redesigned Product Form no longer has a SKU field at all (the old
  // top "Barcode" concept now maps to the implicit Standard variant's own
  // barcode, not products.sku) — so `sku` simply isn't in its payload. Don't
  // let that silently null out a value a product already has (e.g. from
  // bulk import); only overwrite it when a caller explicitly sends one.
  const existingProduct = db.prepare('SELECT sku FROM products WHERE id = ?').get(id);
  const resolvedSku = sku !== undefined ? sku || null : existingProduct ? existingProduct.sku : null;

  const run = db.transaction(() => {
    db.prepare(
      `UPDATE products SET
         name = @name, sku = @sku, company_name = @companyName, category_id = @categoryId, supplier_id = @supplierId,
         base_unit_name = @baseUnitName, min_stock_alert = @minStockAlert, dead_stock_days = @deadStockDays,
         pricing_type = @pricingType, default_percentage = @defaultPercentage, is_agency_item = @isAgencyItem,
         notes = @notes, is_active = @isActive, updated_at = datetime('now')
       WHERE id = @id`
    ).run({
      id,
      name: name.trim(),
      sku: resolvedSku,
      companyName: companyName || null,
      categoryId: categoryId || null,
      supplierId: supplierId || null,
      baseUnitName: baseUnitName || 'Piece',
      minStockAlert: Number(minStockAlert) || 0,
      deadStockDays: deadStockDays || null,
      pricingType: pricingType === 'percentage' ? 'percentage' : 'fixed',
      defaultPercentage: pricingType === 'percentage' ? Number(defaultPercentage) || 0 : null,
      isAgencyItem: isAgencyItem ? 1 : 0,
      notes: notes || null,
      isActive: isActive === false ? 0 : 1,
    });

    // Variants: existing rows (have an id) are updated in place — stock_qty is
    // deliberately left untouched here (Inventory > Stock Adjustments owns it).
    // New rows (no id) are inserted, with an initial stock_movements entry if
    // they carry a starting stock. Rows no longer present are soft-deleted.
    const existingVariantIds = db
      .prepare('SELECT id FROM product_variants WHERE product_id = ? AND is_active = 1')
      .all(id)
      .map((r) => r.id);
    const submittedVariantIds = normalized.variants.filter((v) => v.id).map((v) => v.id);

    const updateVariant = db.prepare('UPDATE product_variants SET variant_name = ?, barcode = ? WHERE id = ?');
    const insertVariant = db.prepare(
      `INSERT INTO product_variants (product_id, variant_name, barcode, stock_qty) VALUES (?, ?, ?, ?)`
    );
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, note)
       VALUES (?, 'purchase', ?, 'initial_stock', 'Initial stock added while editing product')`
    );
    const deactivateVariant = db.prepare('UPDATE product_variants SET is_active = 0 WHERE id = ?');

    for (const v of normalized.variants) {
      if (v.id) {
        updateVariant.run(v.variantName || 'Standard', v.barcode || null, v.id);
      } else {
        const startingStock = Number(v.startingStock) || 0;
        const result = insertVariant.run(id, v.variantName || 'Standard', v.barcode || null, startingStock);
        if (startingStock > 0) insertMovement.run(result.lastInsertRowid, startingStock);
      }
    }
    for (const existingId of existingVariantIds) {
      if (!submittedVariantIds.includes(existingId)) deactivateVariant.run(existingId);
    }

    // Units: same insert/update/soft-delete diff.
    const existingUnitIds = db
      .prepare('SELECT id FROM product_units WHERE product_id = ? AND is_active = 1')
      .all(id)
      .map((r) => r.id);
    const submittedUnitIds = normalized.units.filter((u) => u.id).map((u) => u.id);

    const updateUnit = db.prepare(
      `UPDATE product_units SET unit_name = ?, conversion_factor = ?, retail_price = ?, wholesale_price = ?,
         cost_price = ?, is_default_sale_unit = ? WHERE id = ?`
    );
    const insertUnit = db.prepare(
      `INSERT INTO product_units
         (product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, is_default_sale_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const deactivateUnit = db.prepare('UPDATE product_units SET is_active = 0 WHERE id = ?');

    for (const u of normalized.units) {
      const args = [
        u.unitName,
        Number(u.conversionFactor) || 1,
        Number(u.retailPrice) || 0,
        Number(u.wholesalePrice) || 0,
        Number(u.costPrice) || 0,
        u.isDefaultSaleUnit ? 1 : 0,
      ];
      if (u.id) updateUnit.run(...args, u.id);
      else insertUnit.run(id, ...args);
    }
    for (const existingId of existingUnitIds) {
      if (!submittedUnitIds.includes(existingId)) deactivateUnit.run(existingId);
    }
  });

  try {
    run();
    return { success: true };
  } catch (err) {
    if (/UNIQUE/.test(err.message)) return { success: false, reason: 'A product with that SKU or a variant barcode already exists.' };
    return { success: false, reason: 'Could not save product.' };
  }
}

// ---------- low stock / dead stock ----------

function getLowStock() {
  return ProductModel.getLowStock(getDb());
}

function getDeadStock() {
  return ProductModel.getDeadStock(getDb());
}

// ---------- bulk import ----------
// Accepts already-parsed, already-grouped product payloads (same shape `create`
// takes). Runs the whole batch in one transaction: any single failure rolls
// back everything already inserted in this call, and the caller is told which
// row (by index/name) caused it.
function bulkImport(products) {
  const db = getDb();
  const results = [];

  const run = db.transaction(() => {
    products.forEach((product, index) => {
      const res = create(product);
      results.push({ index, name: product.name, ...res });
      if (!res.success) {
        throw new Error(`Row ${index + 1} ("${product.name || 'unnamed'}"): ${res.reason}`);
      }
    });
  });

  try {
    run();
    return { success: true, results };
  } catch (err) {
    return { success: false, reason: err.message, results };
  }
}

function setActive(id, isActive) {
  const db = getDb();
  db.prepare("UPDATE products SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(isActive ? 1 : 0, id);
  return { success: true };
}

// ---------- bulk actions (All Products page's selection bar) ----------
// Single SQL statement each rather than N calls into update()/setActive() —
// a plain UPDATE ... WHERE id IN (...) is both faster and simpler than
// looping the full product update() (which expects a whole variants/units
// payload, the wrong tool for "just move these to another category").

function bulkSetActive({ ids, isActive }) {
  const db = getDb();
  if (!ids || ids.length === 0) return { success: false, reason: 'No products selected.' };
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE products SET is_active = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`).run(
    isActive ? 1 : 0,
    ...ids
  );
  return { success: true };
}

function bulkSetCategory({ ids, categoryId }) {
  const db = getDb();
  if (!ids || ids.length === 0) return { success: false, reason: 'No products selected.' };
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE products SET category_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`).run(
    categoryId || null,
    ...ids
  );
  return { success: true };
}

function registerProductsIpc() {
  ipcMain.handle('products:list', (event, filters) => list(filters || {}));
  ipcMain.handle('products:get-by-id', (event, { id } = {}) => getById(id));
  ipcMain.handle('products:create', (event, payload) => create(payload || {}));
  ipcMain.handle('products:update', (event, payload) => update(payload || {}));
  ipcMain.handle('products:set-active', (event, { id, isActive } = {}) => setActive(id, isActive));
  ipcMain.handle('products:bulk-set-active', (event, payload) => bulkSetActive(payload || {}));
  ipcMain.handle('products:bulk-set-category', (event, payload) => bulkSetCategory(payload || {}));
  ipcMain.handle('products:check-sku-unique', (event, { sku, excludeId } = {}) => ({
    available: !isSkuTaken(getDb(), sku, excludeId),
  }));
  ipcMain.handle('products:check-barcode-unique', (event, { barcode, excludeVariantId } = {}) => ({
    available: !isBarcodeTaken(getDb(), barcode, excludeVariantId),
  }));
  ipcMain.handle('products:get-low-stock', () => getLowStock());
  ipcMain.handle('products:get-dead-stock', () => getDeadStock());
  ipcMain.handle('products:bulk-import', (event, { products } = {}) => bulkImport(products || []));
}

module.exports = { registerProductsIpc };
