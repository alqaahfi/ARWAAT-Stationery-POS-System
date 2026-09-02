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

  // 1. percentage rule for this exact customer
  if (customer) {
    const rule = db
      .prepare('SELECT * FROM percentage_pricing_rules WHERE product_id = ? AND customer_id = ?')
      .get(product.id, customer.id);
    if (rule) return round2(unit.cost_price * (1 + rule.percentage / 100));
  }

  // 2. percentage rule for the customer's tier
  if (customer && customer.tier) {
    const rule = db
      .prepare('SELECT * FROM percentage_pricing_rules WHERE product_id = ? AND customer_tier = ?')
      .get(product.id, customer.tier);
    if (rule) return round2(unit.cost_price * (1 + rule.percentage / 100));
  }

  // 3. this unit's hardcoded net rate for the customer's tier
  if (customer && customer.tier) {
    const rateColumn = `net_rate_${customer.tier.toLowerCase()}`; // e.g. net_rate_c1
    const rate = unit[rateColumn];
    if (rate !== null && rate !== undefined) return round2(rate);
  }

  // 4. product-level percentage-over-cost pricing (books / agency items)
  if (product.pricing_type === 'percentage') {
    return round2(unit.cost_price * (1 + (product.default_percentage || 0) / 100));
  }

  // 5. fixed pricing — retail vs wholesale by the customer's type (walk-in = retail)
  const isWholesale = customer ? customer.customer_type === 'wholesale' : false;
  return round2(isWholesale ? unit.wholesale_price : unit.retail_price);
}

module.exports = { resolveUnitPrice };
