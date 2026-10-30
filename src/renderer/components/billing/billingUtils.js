// Shared maths and line helpers for the quick Sale and Purchase forms, so both
// bills add up exactly the same way.

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Sold + free units both move stock.
export const lineUnits = (l) => (Number(l.quantity) || 0) + (Number(l.focQuantity) || 0);

// A free (FOC) quantity is never priced: line total is quantity x price only.
export const lineTotal = (l) => round2((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0));

// Trade Price pack sizes: unit cost = trade price - purchase discount % - extra discount (flat), never below 0.
export function tradeUnitCost({ tradePrice, purchaseDiscount, extraDiscount }) {
  const trade = Number(tradePrice) || 0;
  return Math.max(0, round2(trade - (trade * (Number(purchaseDiscount) || 0)) / 100 - (Number(extraDiscount) || 0)));
}

// Purchase-line price fields for a pack size: the trade inputs plus the unit
// cost they work out to, or just the stored buying price for a simple unit.
export function purchasePriceFields(unit) {
  if (unit.pricingMethod !== 'trade') return { pricingMethod: 'simple', unitPrice: unit.costPrice };
  const fields = { tradePrice: unit.tradePrice ?? 0, purchaseDiscount: unit.purchaseDiscount ?? 0, extraDiscount: unit.extraDiscount ?? 0 };
  return { pricingMethod: 'trade', ...fields, unitPrice: tradeUnitCost(fields) };
}

export function computeTotals({ lines, discountMode, discountInput, paidInput }) {
  const subtotal = round2(lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0));
  const rawDiscount = discountMode === 'percentage' ? (subtotal * (Number(discountInput) || 0)) / 100 : Number(discountInput) || 0;
  const discountAmount = Math.min(round2(rawDiscount), subtotal);
  const total = Math.max(0, round2(subtotal - discountAmount));
  const discountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;

  // Nothing typed = paid in full.
  const tendered = paidInput === '' ? total : Number(paidInput) || 0;
  const paid = Math.min(tendered, total);
  const changeDue = Math.max(0, round2(tendered - total));
  const balanceDue = Math.max(0, round2(total - paid));
  const freeUnits = lines.reduce((sum, l) => sum + (Number(l.focQuantity) || 0), 0);

  return { subtotal, discountAmount, discountPercent, total, paid, changeDue, balanceDue, freeUnits };
}

// A cart line from getVariantForCart() details. `price` is what one unit
// costs (purchase) or sells for (sale) right now.
export function buildLine(detail, unit, price, extra = {}) {
  return {
    key: `${detail.variant.id}-${unit.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    variantId: detail.variant.id,
    variantName: detail.variant.variantName,
    productId: detail.product.id,
    productName: detail.product.name,
    baseUnitName: detail.product.baseUnitName,
    stockQty: detail.variant.stockQty,
    units: detail.units,
    unitId: unit.id,
    conversionFactor: unit.conversionFactor,
    quantity: 1,
    focQuantity: 0,
    unitPrice: price,
    costPrice: unit.costPrice,
    // Rule 11: an item added at the counter (waiting for review) may be sold with no stock.
    allowNegative: !!detail.product.needsReview,
    ...extra,
  };
}

// Letterhead for a wholesale A4 invoice: the customer's own, else the shop default,
// else the only one there is.
export function resolveLetterheadId(letterheads, customer) {
  if (customer?.assigned_letterhead_id) return customer.assigned_letterhead_id;
  const explicit = letterheads.find((l) => l.is_default);
  if (explicit) return explicit.id;
  return letterheads.length === 1 ? letterheads[0].id : null;
}
