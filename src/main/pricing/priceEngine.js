// Single source of truth for "what does this unit cost this customer right now".
// Called from sales.ipc.js via IPC — never duplicated in the renderer.

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// productId is intentionally not trusted from the caller — it's derived from
// productUnitId's own row, so a stale/mismatched id passed in can't skew pricing.
function resolveUnitPrice({ db, productUnitId, customerId }) {
  const unit = db.prepare('SELECT * FROM product_units WHERE id = ?').get(productUnitId);
  if (!unit) return null;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(unit.product_id);
  if (!product) return null;

  const customer = customerId ? db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) : null;

  // 0. Customer-specific special pricing (highest precedence)
  if (customerId) {
    const specialRule = db
      .prepare(
        `SELECT * FROM customer_special_prices
         WHERE customer_id = ?
           AND product_id = ?
           AND (product_unit_id = ? OR product_unit_id IS NULL)
         ORDER BY (product_unit_id IS NOT NULL) DESC, id DESC
         LIMIT 1`
      )
      .get(customerId, unit.product_id, productUnitId);

    if (specialRule) {
      if (specialRule.pricing_type === 'fixed' && specialRule.price !== null) {
        return round2(specialRule.price);
      }
      if (specialRule.pricing_type === 'discount_percent' && specialRule.percentage !== null) {
        const isWholesale = customer ? customer.customer_type === 'wholesale' : false;
        const basePrice = isWholesale ? unit.wholesale_price : unit.retail_price;
        return round2(basePrice * (1 - (Number(specialRule.percentage) || 0) / 100));
      }
      if (specialRule.pricing_type === 'margin_percent' && specialRule.percentage !== null) {
        return round2(unit.cost_price * (1 + (Number(specialRule.percentage) || 0) / 100));
      }
    }
  }

  // 1. this unit's hardcoded net rate for the customer's tier
  if (customer && customer.tier) {
    const rateColumn = `net_rate_${customer.tier.toLowerCase()}`; // e.g. net_rate_c1
    const rate = unit[rateColumn];
    if (rate !== null && rate !== undefined) return round2(rate);
  }

  // 2. product-level percentage-over-cost pricing (books / agency items)
  if (product.pricing_type === 'percentage') {
    return round2(unit.cost_price * (1 + (product.default_percentage || 0) / 100));
  }

  // 3. fixed pricing — retail vs wholesale by the customer's type (walk-in = retail)
  const isWholesale = customer ? customer.customer_type === 'wholesale' : false;
  return round2(isWholesale ? unit.wholesale_price : unit.retail_price);
}

module.exports = { resolveUnitPrice };
