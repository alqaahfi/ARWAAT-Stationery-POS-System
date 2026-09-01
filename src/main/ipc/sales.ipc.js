const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { resolveUnitPrice } = require('../pricing/priceEngine');
const { getSaleDetail, buildReceiptData } = require('../printing/receiptData');

// ---------- product search / barcode (feed the cart) ----------

const SEARCH_COLUMNS = `
  pv.id AS variantId, pv.variant_name AS variantName, pv.stock_qty AS stockQty, pv.barcode,
  p.id AS productId, p.name AS productName, p.sku, p.base_unit_name AS baseUnitName
`;

function searchProducts(query) {
  const db = getDb();
  const term = `%${query}%`;
  return db
    .prepare(
      `SELECT ${SEARCH_COLUMNS}
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.is_active = 1 AND p.is_active = 1
         AND (p.name LIKE @term OR p.sku LIKE @term OR pv.barcode LIKE @term OR pv.variant_name LIKE @term)
       ORDER BY p.name
       LIMIT 30`
    )
    .all({ term });
}

// Grouped-by-product version of the search above, for the Cashier Mode
// item-search dropdown: each matched product carries its own Types (matching
// variants) and every active selling Unit (with list prices, for an
// at-a-glance preview only — the price actually charged is still resolved
// per-customer via resolvePrice() at the moment a line is added, same as
// before).
function searchProductsGrouped(query) {
  const db = getDb();
  const term = `%${query}%`;

  const variantRows = db
    .prepare(
      `SELECT ${SEARCH_COLUMNS}
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.is_active = 1 AND p.is_active = 1
         AND (p.name LIKE @term OR p.sku LIKE @term OR pv.barcode LIKE @term OR pv.variant_name LIKE @term)
       ORDER BY p.name, pv.variant_name
       LIMIT 60`
    )
    .all({ term });

  if (variantRows.length === 0) return [];

  const productIds = [...new Set(variantRows.map((r) => r.productId))];
  const placeholders = productIds.map(() => '?').join(',');
  const unitRows = db
    .prepare(
      `SELECT id, product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, is_default_sale_unit
       FROM product_units WHERE product_id IN (${placeholders}) AND is_active = 1
       ORDER BY id`
    )
    .all(...productIds);

  const unitsByProduct = {};
  for (const u of unitRows) {
    (unitsByProduct[u.product_id] ||= []).push({
      id: u.id,
      unitName: u.unit_name,
      conversionFactor: u.conversion_factor,
      retailPrice: u.retail_price,
      wholesalePrice: u.wholesale_price,
      costPrice: u.cost_price,
      isDefaultSaleUnit: !!u.is_default_sale_unit,
    });
  }

  const byProduct = new Map();
  for (const r of variantRows) {
    if (!byProduct.has(r.productId)) {
      byProduct.set(r.productId, {
        productId: r.productId,
        productName: r.productName,
        sku: r.sku,
        baseUnitName: r.baseUnitName,
        types: [],
        units: unitsByProduct[r.productId] || [],
      });
    }
    byProduct.get(r.productId).types.push({
      variantId: r.variantId,
      variantName: r.variantName,
      stockQty: r.stockQty,
      barcode: r.barcode,
    });
  }

  return [...byProduct.values()].slice(0, 20);
}

function getVariantByBarcode(barcode) {
  if (!barcode) return null;
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT ${SEARCH_COLUMNS}
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.barcode = ? AND pv.is_active = 1 AND p.is_active = 1`
      )
      .get(barcode) || null
  );
}

// Full detail for a variant once it's about to enter the cart: every active
// selling unit (so the line's unit dropdown can be populated) + which one is
// the default. cost_price is included here — the renderer, not this handler,
// is responsible for not rendering it to a cashier (see Cart.jsx).
function getVariantForCart(variantId) {
  const db = getDb();
  const variant = db.prepare('SELECT * FROM product_variants WHERE id = ? AND is_active = 1').get(variantId);
  if (!variant) return null;
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(variant.product_id);
  if (!product) return null;

  const units = db
    .prepare('SELECT * FROM product_units WHERE product_id = ? AND is_active = 1 ORDER BY id')
    .all(product.id);
  const defaultUnit = units.find((u) => u.is_default_sale_unit) || units[0];

  return {
    variant: { id: variant.id, variantName: variant.variant_name, stockQty: variant.stock_qty, barcode: variant.barcode },
    product: { id: product.id, name: product.name, baseUnitName: product.base_unit_name, pricingType: product.pricing_type },
    units: units.map((u) => ({
      id: u.id,
      unitName: u.unit_name,
      conversionFactor: u.conversion_factor,
      retailPrice: u.retail_price,
      wholesalePrice: u.wholesale_price,
      costPrice: u.cost_price,
      isDefaultSaleUnit: !!u.is_default_sale_unit,
    })),
    defaultUnitId: defaultUnit ? defaultUnit.id : null,
  };
}

// ---------- discount cap ----------
// null = no cap (admin). A cashier with no explicit grant and no shop default
// gets 0 — fail safe, not fail open.
function getCashierDiscountCap(userId) {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (!user) return 0;
  if (user.role === 'admin') return null;

  const perm = db
    .prepare("SELECT value FROM user_permissions WHERE user_id = ? AND permission_key = 'max_discount_percentage'")
    .get(userId);
  if (perm && perm.value !== null && perm.value !== '') return Number(perm.value);

  const setting = db.prepare("SELECT value FROM settings WHERE key = 'default_cashier_discount_cap'").get();
  if (setting && setting.value !== null && setting.value !== '') return Number(setting.value);

  return 0;
}

// ---------- invoice numbering ----------
// {station}-{YYYYMMDD}-{seq}, seq is per-day-per-station so offline PCs never
// collide before they sync. Station codes are validated (Setup screens) to be
// hyphen-free so splitting on '-' to recover the sequence is unambiguous.
function getNextInvoiceNo(db, stationCode) {
  const today = db.prepare("SELECT strftime('%Y%m%d','now') AS d").get().d;
  const likePattern = `${stationCode}-${today}-%`;
  const rows = db.prepare('SELECT invoice_no FROM sales WHERE invoice_no LIKE ?').all(likePattern);

  let maxSeq = 0;
  for (const row of rows) {
    const parts = row.invoice_no.split('-');
    const seq = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${stationCode}-${today}-${String(maxSeq + 1).padStart(4, '0')}`;
}

// ---------- checkout ----------

function create(payload) {
  const db = getDb();
  const { saleType, customerId, cashierId, letterheadId, items, discountAmount, paidAmount, paymentMethod } = payload;

  if (!cashierId) return { success: false, reason: 'Missing cashier.' };
  if (!items || items.length === 0) return { success: false, reason: 'Cart is empty.' };

  const activation = db.prepare('SELECT * FROM license_activation WHERE id = 1').get();
  const stationCode = (activation && activation.station_code) || 'MAIN';
  const pcRole = activation ? activation.role : 'admin';

  // Subtotal is recomputed from the lines server-side rather than trusted from
  // the client, so a stale/tampered total can't slip through.
  let subtotal = 0;
  for (const item of items) subtotal += Number(item.lineTotal) || 0;

  const discount = Number(discountAmount) || 0;
  const taxAmount = 0;
  const totalAmount = Math.max(0, subtotal - discount + taxAmount);
  const paid = Number(paidAmount) || 0;
  const balanceDue = Math.max(0, totalAmount - paid);

  if (balanceDue > 0 && !customerId) {
    return { success: false, reason: 'Select a customer to sell on credit — walk-in sales must be paid in full.' };
  }

  // Stock validation — no negative-stock sales in this build.
  for (const item of items) {
    const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.productVariantId);
    const unit = db.prepare('SELECT * FROM product_units WHERE id = ?').get(item.productUnitId);
    if (!variant || !unit) return { success: false, reason: 'One of the items in the cart no longer exists.' };

    const baseQty = Number(item.quantity) * unit.conversion_factor;
    if (baseQty > variant.stock_qty) {
      const availableInUnit = (variant.stock_qty / unit.conversion_factor).toFixed(2).replace(/\.?0+$/, '');
      return {
        success: false,
        reason: `Not enough stock for "${variant.variant_name}" — only ${availableInUnit} ${unit.unit_name}(s) available.`,
      };
    }
  }

  const paymentStatus = paid <= 0 ? 'unpaid' : paid >= totalAmount ? 'paid' : 'partial';

  const run = db.transaction(() => {
    const invoiceNo = getNextInvoiceNo(db, stationCode);

    const saleResult = db
      .prepare(
        `INSERT INTO sales
           (invoice_no, sale_type, customer_id, cashier_id, letterhead_id, subtotal, discount_amount,
            tax_amount, total_amount, paid_amount, balance_due, payment_status, is_synced, origin_pc)
         VALUES (@invoiceNo, @saleType, @customerId, @cashierId, @letterheadId, @subtotal, @discountAmount,
                 @taxAmount, @totalAmount, @paidAmount, @balanceDue, @paymentStatus, 0, @stationCode)`
      )
      .run({
        invoiceNo,
        saleType: saleType === 'wholesale' ? 'wholesale' : 'retail',
        customerId: customerId || null,
        cashierId,
        letterheadId: letterheadId || null,
        subtotal,
        discountAmount: discount,
        taxAmount,
        totalAmount,
        paidAmount: paid,
        balanceDue,
        paymentStatus,
        stationCode,
      });
    const saleId = saleResult.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, product_variant_id, product_unit_id, quantity, unit_price, discount_amount, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const decrementStock = db.prepare(
      `UPDATE product_variants SET stock_qty = stock_qty - ?, last_sold_at = datetime('now') WHERE id = ?`
    );
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, reference_id)
       VALUES (?, 'sale', ?, 'sale', ?)`
    );

    for (const item of items) {
      const unit = db.prepare('SELECT * FROM product_units WHERE id = ?').get(item.productUnitId);
      insertItem.run(
        saleId,
        unit.product_id,
        item.productVariantId,
        item.productUnitId,
        item.quantity,
        item.unitPrice,
        item.discountAmount || 0,
        item.lineTotal
      );
      const baseQty = Number(item.quantity) * unit.conversion_factor;
      decrementStock.run(baseQty, item.productVariantId);
      insertMovement.run(item.productVariantId, -baseQty, saleId);
    }

    // Only recorded against a real customer — a walk-in sale has no party/ledger
    // to update, and its money is already fully captured in sales.paid_amount.
    if (paid > 0 && customerId) {
      db.prepare(
        `INSERT INTO payments (party_type, party_id, sale_id, amount, payment_method, received_by)
         VALUES ('customer', ?, ?, ?, ?, ?)`
      ).run(customerId, saleId, paid, paymentMethod || 'cash', cashierId);
    }

    // Admin PC is the sync target already — only a Cashier PC queues its own sales.
    if (pcRole === 'cashier') {
      const fullSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      const fullItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
      db.prepare(`INSERT INTO sync_queue (table_name, record_id, operation, payload) VALUES ('sales', ?, 'insert', ?)`).run(
        saleId,
        JSON.stringify({ sale: fullSale, items: fullItems })
      );
    }

    return { saleId, invoiceNo };
  });

  try {
    const result = run();
    return { success: true, ...result };
  } catch (err) {
    return { success: false, reason: `Could not complete sale: ${err.message}` };
  }
}

function registerSalesIpc() {
  ipcMain.handle('sales:search-products', (event, { query } = {}) => (query && query.trim() ? searchProducts(query.trim()) : []));
  ipcMain.handle('sales:search-products-grouped', (event, { query } = {}) => (query && query.trim() ? searchProductsGrouped(query.trim()) : []));
  ipcMain.handle('sales:get-variant-by-barcode', (event, { barcode } = {}) => getVariantByBarcode(barcode));
  ipcMain.handle('sales:get-variant-for-cart', (event, { variantId } = {}) => getVariantForCart(variantId));
  ipcMain.handle('sales:resolve-price', (event, { productUnitId, customerId } = {}) => ({
    price: resolveUnitPrice({ db: getDb(), productUnitId, customerId }),
  }));
  ipcMain.handle('sales:get-next-invoice-no', () => {
    const db = getDb();
    const activation = db.prepare('SELECT station_code FROM license_activation WHERE id = 1').get();
    const stationCode = (activation && activation.station_code) || 'MAIN';
    return { invoiceNo: getNextInvoiceNo(db, stationCode) };
  });
  ipcMain.handle('sales:get-cashier-discount-cap', (event, { userId } = {}) => ({ capPercentage: getCashierDiscountCap(userId) }));
  ipcMain.handle('sales:create', (event, payload) => create(payload || {}));
  ipcMain.handle('sales:get-sale-detail', (event, { saleId } = {}) => getSaleDetail(saleId));
  ipcMain.handle('sales:get-receipt-data', (event, { saleId, showDues } = {}) => buildReceiptData(saleId, { showDues }));
}

module.exports = { registerSalesIpc, getSaleDetail };
