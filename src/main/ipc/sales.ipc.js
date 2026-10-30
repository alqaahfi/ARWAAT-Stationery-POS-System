const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getCaller, withCallerId } = require('../security/ipcGuard');
const { resolveUnitPrice } = require('../pricing/priceEngine');
const { getSaleDetail, buildReceiptData } = require('../printing/receiptData');
const { logActivity } = require('../activity/activityLog');
const { wholeQty, WHOLE_QTY_MSG } = require('../validation/quantity');
const { peekApproval, consumeApproval } = require('../security/approvals');

// ---------- product search / barcode (feed the cart) ----------

const SEARCH_COLUMNS = `
  pv.id AS variantId, pv.variant_name AS variantName, pv.stock_qty AS stockQty, pv.barcode,
  p.id AS productId, p.name AS productName, p.sku, p.base_unit_name AS baseUnitName, p.min_stock_alert AS minStockAlert,
  p.needs_review AS needsReview
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
         AND (p.name LIKE @term OR p.search_alias LIKE @term OR p.sku LIKE @term OR pv.barcode LIKE @term OR pv.variant_name LIKE @term OR pv.search_alias LIKE @term)
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
         AND (p.name LIKE @term OR p.search_alias LIKE @term OR p.sku LIKE @term OR pv.barcode LIKE @term OR pv.variant_name LIKE @term OR pv.search_alias LIKE @term)
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
        needsReview: !!r.needsReview, // rule 11: added at the counter — may be sold with no stock
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
    product: { id: product.id, name: product.name, baseUnitName: product.base_unit_name, pricingType: product.pricing_type, needsReview: !!product.needs_review },
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
  // A voided bill deletes its row, so the highest number alone would be handed out again.
  // The last number ever issued today is remembered separately and never goes back down.
  const issued = db.prepare('SELECT value FROM settings WHERE key = ?').get(`last_invoice_seq:${stationCode}:${today}`);
  if (issued && Number(issued.value) > maxSeq) maxSeq = Number(issued.value);
  return `${stationCode}-${today}-${String(maxSeq + 1).padStart(4, '0')}`;
}

function rememberInvoiceNo(db, invoiceNo) {
  const parts = invoiceNo.split('-');
  const seq = parseInt(parts[parts.length - 1], 10);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(`last_invoice_seq:${parts[0]}:${parts[1]}`, String(seq));
}

// ---------- checkout / edit / void ----------

class SaleError extends Error {}

// Rule 12: something on this save needs the Admin's approval (asked for on the cashier screen).
const APPROVAL_LABELS = {
  discount_over_cap: 'Discount above your limit',
  sell_without_stock: 'Selling more than is in stock',
  change_old_bill: 'Changing an older bill',
  void_old_bill: 'Voiding an older bill',
};
class NeedApproval extends Error {
  constructor(reasons, message, extra = {}) {
    super(message);
    this.reasons = reasons;
    this.extra = extra;
  }
}
// The Admin selling more than is in stock just confirms it on their own screen.
class NeedStockConfirm extends Error {
  constructor(message, shortages) {
    super(message);
    this.shortages = shortages;
  }
}

function approvalRefusal(err) {
  return {
    success: false,
    needsApproval: true,
    approvalReasons: err.reasons,
    approvalLabels: err.reasons.map((r) => APPROVAL_LABELS[r] || r),
    reason: err.message,
    ...err.extra,
  };
}

// One log row per approved save: what, bill, cashier, admin, when (rule 12).
function logApproval(db, { reasons, details, saleId, invoiceNo, cashierId, adminId, originPc }) {
  db.prepare(
    `INSERT INTO approvals (action, details, sale_id, invoice_no, cashier_id, admin_id, origin_pc)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(reasons.join(','), details.filter(Boolean).join('; ') || null, saleId || null, invoiceNo || null, cashierId || null, adminId || null, originPc || null);
}


// Admin may change any bill (rule 13: except bills with returns, checked separately);
// a cashier only their own bills. Returns true when
// the bill is past the cashier's time window, so the change needs the Admin's
// approval (rule 12); false when it may go ahead.
function billNeedsApproval(db, sale, actorId) {
  const actor = db.prepare('SELECT role FROM users WHERE id = ?').get(actorId);
  if (!actor) throw new SaleError('Unknown user.');
  if (actor.role === 'admin') return false;
  if (sale.cashier_id !== actorId) throw new SaleError('You can only change your own bills.');
  // Rule 13: a cashier may change their own bill for 10 minutes after saving it; after that only with
  // the Admin's approval. (A clock set backwards makes the age negative: still inside the window.)
  const minutes = db.prepare("SELECT (julianday('now') - julianday(?)) * 1440 AS m").get(sale.created_at).m;
  return minutes > CASHIER_EDIT_MINUTES;
}
const CASHIER_EDIT_MINUTES = 10;
const OLD_BILL_MESSAGE = `This bill was saved more than ${CASHIER_EDIT_MINUTES} minutes ago. The Admin must approve changing it.`;

// Rule 5: a voided bill is kept for history but can never be edited, voided again or returned.
function assertNotVoided(sale) {
  if (sale && sale.is_voided) throw new SaleError('This bill was voided. It can no longer be changed.');
}

// last_sold_at follows the newest bill that still counts (a void takes its bill out).
function refreshLastSold(db, variantIds) {
  const set = db.prepare(
    `UPDATE product_variants SET last_sold_at = (
       SELECT MAX(s.created_at) FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE si.product_variant_id = product_variants.id AND s.is_voided = 0
     ) WHERE id = ?`
  );
  for (const id of new Set(variantIds)) set.run(id);
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

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const PRICE_TOLERANCE = 0.01;

// Rule 1: the server decides every line's price. Each line is re-resolved with
// the price engine for this customer and pack size; a price sent by the screen
// that differs by more than 0.01 is refused, unless the caller is the Admin
// (manual price override is Admin-only). While editing a saved bill for the
// same customer, the bill's own stored price for that pack size is also
// accepted (the bill keeps the price it was sold at). The server's price is
// what gets stored, and line totals are recomputed from it.
function priceLines(db, items, { customerId, actorIsAdmin, original }) {
  const priced = [];
  const changed = [];
  for (const item of items) {
    const variant = db.prepare('SELECT id, product_id, variant_name FROM product_variants WHERE id = ?').get(item.productVariantId);
    const unit = db.prepare('SELECT id, product_id, unit_name FROM product_units WHERE id = ?').get(item.productUnitId);
    if (!variant || !unit || unit.product_id !== variant.product_id) {
      return { error: 'One of the items in the cart no longer exists.' };
    }
    const enginePrice = resolveUnitPrice({ db, productUnitId: unit.id, customerId: customerId || null });
    if (enginePrice === null || enginePrice === undefined) return { error: 'One of the items in the cart no longer exists.' };
    const sent = Number(item.unitPrice);
    let price = enginePrice;
    if (Math.abs(sent - enginePrice) > PRICE_TOLERANCE) {
      const keepsBillPrice =
        original &&
        (original.customerId || null) === (customerId || null) &&
        original.prices.some((p) => p.unitId === unit.id && Math.abs(p.price - sent) <= PRICE_TOLERANCE);
      if (actorIsAdmin || keepsBillPrice) {
        price = round2(sent);
      } else {
        const name = db.prepare('SELECT name FROM products WHERE id = ?').get(unit.product_id)?.name || 'an item';
        changed.push({ productVariantId: variant.id, productUnitId: unit.id, name, sentPrice: sent, price: enginePrice });
      }
    }
    const qty = Number(item.quantity);
    priced.push({ ...item, unitPrice: price, lineTotal: round2(qty * price) });
  }
  return { priced, changed };
}

function saveSale(payload, editSaleId) {
  const db = getDb();
  // Rule 9: cash only — any paymentMethod the screen sends is ignored; new payments are recorded as 'cash'.
  const { saleType, customerId, cashierId, letterheadId, discountAmount, paidAmount } = payload;
  let { items } = payload;

  if (!cashierId) return { success: false, reason: 'Missing cashier.' };
  if (!items || items.length === 0) return { success: false, reason: 'Cart is empty.' };

  const activation = db.prepare('SELECT * FROM station_config WHERE id = 1').get();
  const stationCode = (activation && activation.station_code) || 'MAIN';

  // Server-side checks: the screen already blocks these, but the main process must not trust it.
  for (const item of items) {
    const qty = Number(item.quantity), foc = Number(item.focQuantity) || 0, price = Number(item.unitPrice), line = Number(item.lineTotal);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 1e6) return { success: false, reason: 'Every item needs a quantity above zero.' };
    if (!Number.isFinite(foc) || foc < 0) return { success: false, reason: 'Free quantity cannot be negative.' };
    if (wholeQty(qty) === null || wholeQty(foc, { allowZero: true }) === null) return { success: false, reason: WHOLE_QTY_MSG };
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(line) || line < 0) return { success: false, reason: 'An item has an invalid price.' };
    if (Math.abs(line - qty * price) > 0.02) return { success: false, reason: 'An item total does not match its quantity and price.' };
  }

  const actor = db.prepare('SELECT role FROM users WHERE id = ?').get(cashierId);
  if (!actor) return { success: false, reason: 'Unknown user.' };
  const actorIsAdmin = actor.role === 'admin';

  let original = null;
  if (editSaleId) {
    const existing = db.prepare('SELECT customer_id FROM sales WHERE id = ?').get(editSaleId);
    if (existing) {
      original = {
        customerId: existing.customer_id,
        prices: db
          .prepare('SELECT product_unit_id AS unitId, unit_price AS price FROM sale_items WHERE sale_id = ?')
          .all(editSaleId),
      };
    }
  }
  const pricing = priceLines(db, items, { customerId, actorIsAdmin, original });
  if (pricing.error) return { success: false, reason: pricing.error };
  if (pricing.changed.length) {
    const first = pricing.changed[0];
    const more = pricing.changed.length > 1 ? ` (and ${pricing.changed.length - 1} more)` : '';
    return {
      success: false,
      priceChanged: true,
      changedLines: pricing.changed,
      reason: `The price of "${first.name}" is now ${first.price.toFixed(2)}${more}. The bill was not saved — check the new total and save again.`,
    };
  }
  items = pricing.priced;

  // Subtotal is recomputed from the server-priced lines rather than trusted
  // from the client, so a stale/tampered total can't slip through.
  let subtotal = 0;
  for (const item of items) subtotal += item.lineTotal;
  subtotal = round2(subtotal);

  const discount = Number(discountAmount) || 0;
  const taxAmount = 0;
  const totalAmount = Math.max(0, round2(subtotal - discount + taxAmount));
  const paid = Number(paidAmount) || 0;
  if (!Number.isFinite(Number(discountAmount || 0)) || discount < 0) return { success: false, reason: 'Discount cannot be negative.' };
  if (discount > subtotal + 0.005) return { success: false, reason: 'Discount cannot be more than the bill total.' };
  if (!Number.isFinite(Number(paidAmount || 0)) || paid < 0) return { success: false, reason: 'Amount paid cannot be negative.' };
  // Rule 12: a valid Admin approval (from the approval box on this window) lets a
  // cashier go past the discount cap, sell without stock, or change an older bill.
  const approvedBy = actorIsAdmin ? null : peekApproval(payload.approvalToken, cashierId);
  const approved = []; // what the approval was used for
  const approvalDetails = [];
  const discountCap = getCashierDiscountCap(cashierId); // null = Admin, no cap
  if (discountCap !== null && subtotal > 0 && discount > (subtotal * discountCap) / 100 + 0.01) {
    const pct = Math.round((discount / subtotal) * 10000) / 100;
    if (!approvedBy) {
      return approvalRefusal(new NeedApproval(['discount_over_cap'], `Discount is more than your limit of ${discountCap}%. The Admin must approve it.`));
    }
    approved.push('discount_over_cap');
    approvalDetails.push(`Discount ${pct}% (limit ${discountCap}%)`);
  }
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
      assertNotVoided(existing);
      if (billNeedsApproval(db, existing, cashierId)) {
        if (!approvedBy) throw new NeedApproval(['change_old_bill'], OLD_BILL_MESSAGE);
        approved.push('change_old_bill');
        approvalDetails.push(`Changed ${existing.invoice_no}`);
      }
      assertNoReturns(db, editSaleId);
      reverseSaleStock(db, existing, { keepReference: true, note: `Reversed for edit of ${existing.invoice_no}` });
      db.prepare("DELETE FROM payments WHERE sale_id = ? AND party_type = 'customer'").run(editSaleId);
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(editSaleId);
      invoiceNo = existing.invoice_no;
    }

    // Stock check runs after the reversal, so an edited bill can reuse what it had already taken.
    // Sold + free units both count, and several lines of the same variant are checked together.
    // Rule 12: not enough stock is no longer a dead end — a cashier needs the Admin's approval,
    // the Admin confirms; the stock goes below zero and the item goes on "Stock to recount".
    const shortages = [];
    const seenVariants = new Set();
    for (const item of items) {
      const variant = db.prepare('SELECT * FROM product_variants WHERE id = ?').get(item.productVariantId);
      const unit = db.prepare('SELECT * FROM product_units WHERE id = ?').get(item.productUnitId);
      if (!variant || !unit) throw new SaleError('One of the items in the cart no longer exists.');
      if (seenVariants.has(variant.id)) continue;
      seenVariants.add(variant.id);
      // Rule 11: an item added at the counter (waiting for review) can be sold with no stock.
      const product = db.prepare('SELECT name, needs_review FROM products WHERE id = ?').get(variant.product_id);
      if (product && product.needs_review) continue;
      const needed = items
        .filter((i) => i.productVariantId === item.productVariantId)
        .reduce((sum, i) => sum + baseQtyOf(db, i), 0);
      if (needed > variant.stock_qty) {
        const label = variant.variant_name && variant.variant_name !== 'Standard' ? `${product.name} (${variant.variant_name})` : product.name;
        shortages.push({ variantId: variant.id, name: label, inStock: variant.stock_qty, needed });
      }
    }
    if (shortages.length) {
      const list = shortages.map((x) => `${x.name}: ${x.inStock} in stock, selling ${x.needed}`).join('; ');
      if (actorIsAdmin) {
        if (!payload.allowNegativeStock) throw new NeedStockConfirm(`Not enough stock — ${list}. Sell anyway? Stock will go below zero.`, shortages);
      } else {
        if (!approvedBy) throw new NeedApproval(['sell_without_stock'], `Not enough stock — ${list}. The Admin must approve selling it.`, { shortages });
        approved.push('sell_without_stock');
        approvalDetails.push(list);
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
      rememberInvoiceNo(db, invoiceNo);
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
      ).run(customerId, saleId, paid, 'cash', cashierId); // rule 9: cash only
    }

    // Rule 12: what was sold without stock goes on the Admin's "Stock to recount" list.
    const recount = db.prepare(
      `INSERT INTO stock_recount (product_variant_id, sale_id, reason, note, created_by) VALUES (?, ?, 'sold_without_stock', ?, ?)`
    );
    for (const x of shortages) recount.run(x.variantId, saleId, `Sold ${x.needed} with ${x.inStock} in stock (${invoiceNo})`, cashierId);

    if (approvedBy && approved.length) {
      logApproval(db, { reasons: approved, details: approvalDetails, saleId, invoiceNo, cashierId, adminId: approvedBy, originPc: stationCode });
    }

    // sync_outbox rows come from the triggers in 022 / 030 — no manual queuing.
    return { saleId, invoiceNo, approvalUsed: approved.length > 0 };
  });

  try {
    const result = run();
    if (result.approvalUsed) consumeApproval(payload.approvalToken);
    delete result.approvalUsed;

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
    if (err instanceof NeedApproval) return approvalRefusal(err);
    if (err instanceof NeedStockConfirm) return { success: false, needsStockConfirm: true, shortages: err.shortages, reason: err.message };
    if (err instanceof SaleError) return { success: false, reason: err.message };
    return { success: false, reason: `Could not complete sale: ${err.message}` };
  }
}

const create = (payload) => saveSale(payload, null);

function updateSale(payload) {
  if (!payload.saleId) return { success: false, reason: 'Missing bill.' };
  return saveSale(payload, payload.saleId);
}

// Rule 5: a void keeps the bill (is_voided, voided_at, voided_by) and its lines for history,
// puts the stock back, and marks the bill's payments voided — from then on it counts as zero
// everywhere. Its invoice number stays taken, so it is never handed out again.
function voidSale({ saleId, userId, approvalToken } = {}) {
  const db = getDb();
  let approvalUsed = false;
  try {
    const sale = db.transaction(() => {
      const row = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      if (!row) throw new SaleError('That bill no longer exists.');
      if (row.is_voided) throw new SaleError('This bill was already voided.');
      if (billNeedsApproval(db, row, userId)) {
        const adminId = peekApproval(approvalToken, userId);
        if (!adminId) throw new NeedApproval(['void_old_bill'], OLD_BILL_MESSAGE.replace('changing', 'voiding'));
        logApproval(db, { reasons: ['void_old_bill'], details: [`Voided ${row.invoice_no} (${Number(row.total_amount).toFixed(2)})`], saleId, invoiceNo: row.invoice_no, cashierId: userId, adminId, originPc: row.origin_pc });
        approvalUsed = true;
      }
      assertNoReturns(db, saleId);
      reverseSaleStock(db, row, { keepReference: true, note: `Voided ${row.invoice_no}` });
      db.prepare("UPDATE payments SET is_voided = 1 WHERE sale_id = ? AND party_type = 'customer'").run(saleId);
      db.prepare("UPDATE sales SET is_voided = 1, voided_at = datetime('now'), voided_by = ? WHERE id = ?").run(userId, saleId);
      refreshLastSold(db, db.prepare('SELECT product_variant_id FROM sale_items WHERE sale_id = ?').all(saleId).map((r) => r.product_variant_id));
      return row;
    })();
    if (approvalUsed) consumeApproval(approvalToken);
    logActivity(db, {
      userId,
      action: 'sale_voided',
      description: `Sale ${sale.invoice_no} voided — ${Number(sale.total_amount).toFixed(2)}`,
      referenceType: 'sale',
      referenceId: saleId,
    });
    return { success: true, invoiceNo: sale.invoice_no };
  } catch (err) {
    if (err instanceof NeedApproval) return approvalRefusal(err);
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
              (SELECT COUNT(*) FROM sale_returns r WHERE r.sale_id = s.id) AS return_count,
              s.is_voided
       FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id
       JOIN users u ON u.id = s.cashier_id
       WHERE date(s.created_at, 'localtime') = date('now', 'localtime')
         AND (? = 'admin' OR s.cashier_id = ?)
       ORDER BY s.created_at DESC, s.id DESC`
    )
    .all(user.role, userId);
  return rows.map((r) => ({ ...r, is_voided: !!r.is_voided, locked: r.return_count > 0 || !!r.is_voided }));
}

// Everything the POS needs to rebuild the cart from a saved bill (edit mode).
function getForEdit({ saleId, userId } = {}) {
  const db = getDb();
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!sale) return { success: false, reason: 'That bill no longer exists.' };
  let needsApproval = false;
  try {
    assertNotVoided(sale);
    needsApproval = billNeedsApproval(db, sale, userId);
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
    .prepare("SELECT payment_method FROM payments WHERE sale_id = ? AND party_type = 'customer' AND is_voided = 0 LIMIT 1")
    .get(saleId);
  const customer = sale.customer_id
    ? db.prepare('SELECT id, name, customer_type, tier, phone FROM customers WHERE id = ?').get(sale.customer_id)
    : null;
  // needsApproval: the bill is past this cashier's window — saving the change will ask for the Admin (rule 12).
  return { success: true, sale, lines, customer, paymentMethod: payment ? payment.payment_method : 'cash', needsApproval };
}

function registerSalesIpc() {
  ipcMain.handle('sales:search-products', (event, { query } = {}) => (query && query.trim() ? searchProducts(query.trim()) : []));
  ipcMain.handle('sales:search-products-grouped', (event, { query } = {}) => (query && query.trim() ? searchProductsGrouped(query.trim()) : []));
  ipcMain.handle('sales:get-variant-by-barcode', (event, { barcode } = {}) => getVariantByBarcode(barcode));
  ipcMain.handle('sales:get-product-types', (event, { productId } = {}) =>
    getDb()
      .prepare(
        `SELECT pv.id AS variantId, pv.variant_name AS variantName, pv.stock_qty AS stockQty
         FROM product_variants pv JOIN products p ON p.id = pv.product_id
         WHERE pv.product_id = ? AND pv.is_active = 1 AND p.is_active = 1 ORDER BY pv.id`
      )
      .all(productId)
  );
  ipcMain.handle('sales:get-variant-for-cart', (event, { variantId } = {}) => getVariantForCart(variantId));
  ipcMain.handle('sales:resolve-price', (event, { productUnitId, customerId } = {}) => ({
    price: resolveUnitPrice({ db: getDb(), productUnitId, customerId }),
  }));
  ipcMain.handle('sales:get-next-invoice-no', () => {
    const db = getDb();
    const activation = db.prepare('SELECT station_code FROM station_config WHERE id = 1').get();
    const stationCode = (activation && activation.station_code) || 'MAIN';
    return { invoiceNo: getNextInvoiceNo(db, stationCode) };
  });
  // The cashier / acting user is always the signed-in caller, never an id from the renderer.
  ipcMain.handle('sales:get-cashier-discount-cap', (event) => ({ capPercentage: getCashierDiscountCap(getCaller(event)?.userId) }));
  ipcMain.handle('sales:create', (event, payload) => create(withCallerId(event, payload, 'cashierId')));
  ipcMain.handle('sales:update', (event, payload) => updateSale(withCallerId(event, payload, 'cashierId')));
  ipcMain.handle('sales:void', (event, payload) => voidSale(withCallerId(event, payload, 'userId')));
  ipcMain.handle('sales:list-recent', (event, payload) => listRecent(withCallerId(event, payload, 'userId')));
  ipcMain.handle('sales:get-for-edit', (event, payload) => getForEdit(withCallerId(event, payload, 'userId')));
  ipcMain.handle('sales:get-sale-detail', (event, { saleId } = {}) => getSaleDetail(saleId));
  ipcMain.handle('sales:get-receipt-data', (event, { saleId, showDues } = {}) => buildReceiptData(saleId, { showDues }));
}

module.exports = { registerSalesIpc, getSaleDetail };
