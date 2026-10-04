const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { resolveUnitPrice } = require('../pricing/priceEngine');
const { getSaleDetail, buildReceiptData } = require('../printing/receiptData');
const { logActivity } = require('../activity/activityLog');

// ---------- product search / barcode (feed the cart) ----------

const SEARCH_COLUMNS = `
  pv.id AS variantId, pv.variant_name AS variantName, pv.stock_qty AS stockQty, pv.barcode,
  p.id AS productId, p.name AS productName, p.sku, p.base_unit_name AS baseUnitName, p.min_stock_alert AS minStockAlert
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
      `SELECT id, product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, pricing_method, trade_price, purchase_discount, extra_discount, is_default_sale_unit
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
      pricingMethod: u.pricing_method || 'simple',
      tradePrice: u.trade_price,
      purchaseDiscount: u.purchase_discount,
      extraDiscount: u.extra_discount,
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
        minStockAlert: r.minStockAlert,
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
      pricingMethod: u.pricing_method || 'simple',
      tradePrice: u.trade_price,
      purchaseDiscount: u.purchase_discount,
      extraDiscount: u.extra_discount,
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

// ---------- checkout / edit / void ----------

class SaleError extends Error {}

const localToday = (db) => db.prepare("SELECT date('now','localtime') AS d").get().d;

// Admin may change any bill; a cashier only their own bills from today (local day).
function assertCanChange(db, sale, actorId) {
  const actor = db.prepare('SELECT role FROM users WHERE id = ?').get(actorId);
  if (!actor) throw new SaleError('Unknown user.');
  if (actor.role === 'admin') return;
  if (sale.cashier_id !== actorId) throw new SaleError('You can only change your own bills.');
  const day = db.prepare("SELECT date(?, 'localtime') AS d").get(sale.created_at).d;
  if (day !== localToday(db)) throw new SaleError('You can only change bills made today.');
}

function assertNoReturns(db, saleId) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM sale_returns WHERE sale_id = ?').get(saleId).n;
  if (n > 0) throw new SaleError('Items from this bill were already returned, so it can no longer be changed.');
}

// Puts every sold + free unit back on the shelf. Written as stock movements so other PCs apply the same delta.
function reverseSaleStock(db, sale, { keepReference, note }) {
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
  const addStock = db.prepare('UPDATE product_variants SET stock_qty = stock_qty + ? WHERE id = ?');
  const insertMovement = db.prepare(
    `INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type, reference_id, note)
     VALUES (?, 'adjustment', ?, ?, ?, ?)`
  );
  for (const item of items) {
    const unit = db.prepare('SELECT conversion_factor FROM product_units WHERE id = ?').get(item.product_unit_id);
    const baseQty = (Number(item.quantity) + Number(item.foc_quantity || 0)) * unit.conversion_factor;
    addStock.run(baseQty, item.product_variant_id);
    insertMovement.run(
      item.product_variant_id,
      baseQty,
      keepReference ? 'sale' : null,
      keepReference ? sale.id : null,
      note
    );
  }
}

function baseQtyOf(db, item) {
  const unit = db.prepare('SELECT conversion_factor FROM product_units WHERE id = ?').get(item.productUnitId);
  return (Number(item.quantity) + (Number(item.focQuantity) || 0)) * (unit ? unit.conversion_factor : 1);
}

function saveSale(payload, editSaleId) {
  const db = getDb();
  const { saleType, customerId, cashierId, letterheadId, items, discountAmount, paidAmount, paymentMethod } = payload;

  if (!cashierId) return { success: false, reason: 'Missing cashier.' };
  if (!items || items.length === 0) return { success: false, reason: 'Cart is empty.' };

  const activation = db.prepare('SELECT * FROM license_activation WHERE id = 1').get();
  const stationCode = (activation && activation.station_code) || 'MAIN';

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

  const paymentStatus = paid <= 0 ? 'unpaid' : paid >= totalAmount ? 'paid' : 'partial';

  const run = db.transaction(() => {
    let saleId = editSaleId;
    let invoiceNo;

    if (editSaleId) {
      const existing = db.prepare('SELECT * FROM sales WHERE id = ?').get(editSaleId);
      if (!existing) throw new SaleError('That bill no longer exists.');
      assertCanChange(db, existing, cashierId);
      assertNoReturns(db, editSaleId);
      reverseSaleStock(db, existing, { keepReference: true, note: `Reversed for edit of ${existing.invoice_no}` });
      db.prepare("DELETE FROM payments WHERE sale_id = ? AND party_type = 'customer'").run(editSaleId);
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(editSaleId);
      invoiceNo = existing.invoice_no;
    }

    // Stock check runs after the reversal, so an edited bill can reuse what it had already taken.
    // Sold + free units both count, and several lines of the same variant are checked together.
    for (const item of items) {
      const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.productVariantId);
      const unit = db.prepare('SELECT * FROM product_units WHERE id = ?').get(item.productUnitId);
      if (!variant || !unit) throw new SaleError('One of the items in the cart no longer exists.');
      const needed = items
        .filter((i) => i.productVariantId === item.productVariantId)
        .reduce((sum, i) => sum + baseQtyOf(db, i), 0);
      if (needed > variant.stock_qty) {
        const availableInUnit = (variant.stock_qty / unit.conversion_factor).toFixed(2).replace(/\.?0+$/, '');
        throw new SaleError(
          `Not enough stock for "${variant.variant_name}" — only ${availableInUnit} ${unit.unit_name}(s) available (free items count too).`
        );
      }
    }

    const fields = {
      saleType: saleType === 'wholesale' ? 'wholesale' : 'retail',
      customerId: customerId || null,
      letterheadId: letterheadId || null,
      subtotal,
      discountAmount: discount,
      taxAmount,
      totalAmount,
      paidAmount: paid,
      balanceDue,
      paymentStatus,
    };

    if (editSaleId) {
      db.prepare(
        `UPDATE sales SET sale_type=@saleType, customer_id=@customerId, letterhead_id=@letterheadId, subtotal=@subtotal,
           discount_amount=@discountAmount, tax_amount=@taxAmount, total_amount=@totalAmount, paid_amount=@paidAmount,
           balance_due=@balanceDue, payment_status=@paymentStatus WHERE id=@saleId`
      ).run({ ...fields, saleId: editSaleId });
    } else {
      invoiceNo = getNextInvoiceNo(db, stationCode);
      saleId = db
        .prepare(
          `INSERT INTO sales
             (invoice_no, sale_type, customer_id, cashier_id, letterhead_id, subtotal, discount_amount,
              tax_amount, total_amount, paid_amount, balance_due, payment_status, is_synced, origin_pc)
           VALUES (@invoiceNo, @saleType, @customerId, @cashierId, @letterheadId, @subtotal, @discountAmount,
                   @taxAmount, @totalAmount, @paidAmount, @balanceDue, @paymentStatus, 0, @stationCode)`
        )
        .run({ ...fields, invoiceNo, cashierId, stationCode }).lastInsertRowid;
    }

    const insertItem = db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, product_variant_id, product_unit_id, quantity, foc_quantity, unit_price, discount_amount, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      const foc = Math.max(0, Number(item.focQuantity) || 0);
      insertItem.run(
        saleId,
        unit.product_id,
        item.productVariantId,
        item.productUnitId,
        item.quantity,
        foc,
        item.unitPrice,
        item.discountAmount || 0,
        item.lineTotal
      );
      const baseQty = (Number(item.quantity) + foc) * unit.conversion_factor;
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

    // sync_outbox rows come from the triggers in 022 / 030 — no manual queuing.
    return { saleId, invoiceNo };
  });

  try {
    const result = run();

    const currencyRow = db.prepare("SELECT value FROM settings WHERE key = 'currency_symbol'").get();
    const currency = currencyRow?.value || 'Rs.';
    const itemCount = items.length;
    logActivity(db, {
      userId: cashierId,
      action: editSaleId ? 'sale_edited' : 'sale_created',
      description: `Sale ${result.invoiceNo} ${editSaleId ? 'edited' : 'created'} — ${saleType} — ${currency}${totalAmount.toFixed(2)} (${itemCount} item${itemCount === 1 ? '' : 's'})`,
      referenceType: 'sale',
      referenceId: result.saleId,
    });

    return { success: true, ...result };
  } catch (err) {
    if (err instanceof SaleError) return { success: false, reason: err.message };
    return { success: false, reason: `Could not complete sale: ${err.message}` };
  }
}

const create = (payload) => saveSale(payload, null);

function updateSale(payload) {
  if (!payload.saleId) return { success: false, reason: 'Missing bill.' };
  return saveSale(payload, payload.saleId);
}

function voidSale({ saleId, userId } = {}) {
  const db = getDb();
  try {
    const sale = db.transaction(() => {
      const row = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      if (!row) throw new SaleError('That bill no longer exists.');
      assertCanChange(db, row, userId);
      assertNoReturns(db, saleId);
      reverseSaleStock(db, row, { keepReference: false, note: `Voided ${row.invoice_no}` });
      db.prepare("DELETE FROM payments WHERE sale_id = ? AND party_type = 'customer'").run(saleId);
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId);
      db.prepare('DELETE FROM sales WHERE id = ?').run(saleId);
      return row;
    })();
    logActivity(db, {
      userId,
      action: 'sale_voided',
      description: `Sale ${sale.invoice_no} voided — ${Number(sale.total_amount).toFixed(2)}`,
      referenceType: 'sale',
      referenceId: saleId,
    });
    return { success: true, invoiceNo: sale.invoice_no };
  } catch (err) {
    if (err instanceof SaleError) return { success: false, reason: err.message };
    return { success: false, reason: `Could not void bill: ${err.message}` };
  }
}

// Today's (local day) bills for the recent-bills panel: the cashier's own; Admin sees everyone's.
function listRecent({ userId } = {}) {
  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  if (!user) return [];
  const rows = db
    .prepare(
      `SELECT s.id, s.invoice_no, s.created_at, s.total_amount, s.paid_amount, s.balance_due, s.sale_type, s.cashier_id,
              c.name AS customer_name, u.full_name AS cashier_name,
              (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count,
              (SELECT COUNT(*) FROM sale_returns r WHERE r.sale_id = s.id) AS return_count
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       JOIN users u ON u.id = s.cashier_id
       WHERE date(s.created_at, 'localtime') = date('now', 'localtime')
         AND (? = 'admin' OR s.cashier_id = ?)
       ORDER BY s.created_at DESC, s.id DESC`
    )
    .all(user.role, userId);
  return rows.map((r) => ({ ...r, locked: r.return_count > 0 }));
}

// Everything the POS needs to rebuild the cart from a saved bill (edit mode).
function getForEdit({ saleId, userId } = {}) {
  const db = getDb();
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!sale) return { success: false, reason: 'That bill no longer exists.' };
  try {
    assertCanChange(db, sale, userId);
    assertNoReturns(db, saleId);
  } catch (err) {
    return { success: false, reason: err.message };
  }
  const lines = db
    .prepare(
      `SELECT si.*, p.name AS product_name, p.sku, p.base_unit_name, p.min_stock_alert,
              pv.variant_name, pv.stock_qty, pv.barcode, pu.unit_name, pu.conversion_factor
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN product_variants pv ON pv.id = si.product_variant_id
       JOIN product_units pu ON pu.id = si.product_unit_id
       WHERE si.sale_id = ? ORDER BY si.id`
    )
    .all(saleId);
  const payment = db
    .prepare("SELECT payment_method FROM payments WHERE sale_id = ? AND party_type = 'customer' LIMIT 1")
    .get(saleId);
  const customer = sale.customer_id
    ? db.prepare('SELECT id, name, customer_type, tier, phone FROM customers WHERE id = ?').get(sale.customer_id)
    : null;
  return { success: true, sale, lines, customer, paymentMethod: payment ? payment.payment_method : 'cash' };
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
  ipcMain.handle('sales:update', (event, payload) => updateSale(payload || {}));
  ipcMain.handle('sales:void', (event, payload) => voidSale(payload || {}));
  ipcMain.handle('sales:list-recent', (event, payload) => listRecent(payload || {}));
  ipcMain.handle('sales:get-for-edit', (event, payload) => getForEdit(payload || {}));
  ipcMain.handle('sales:get-sale-detail', (event, { saleId } = {}) => getSaleDetail(saleId));
  ipcMain.handle('sales:get-receipt-data', (event, { saleId, showDues } = {}) => buildReceiptData(saleId, { showDues }));
}

module.exports = { registerSalesIpc, getSaleDetail };
