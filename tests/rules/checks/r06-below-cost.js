// Rule 6: below-cost selling price = warning (allowed after confirm); a cashier
// never sells below cost unless the Admin set that price on the product.
const assert = require('assert');

module.exports = async (t, check) => {
  const { belowCostIssues } = t.m('pricing/belowCost');
  const pen = t.addProduct({ name: 'Pen', retail: 100, wholesale: 90, cost: 60, stock: 50 });
  const cheap = t.addProduct({ name: 'Clearance', retail: 40, wholesale: 40, cost: 60, stock: 50 }); // Admin set below cost
  const sale = (lines, as) =>
    t.invoke('sales:create', { saleType: 'retail', customerId: null, items: lines, discountAmount: 0, paidAmount: 1e5, paymentMethod: 'cash' }, as);

  await check('R06-01', 'below-cost check finds retail, wholesale and price levels under the buying price', () => {
    const issues = belowCostIssues([{ unitName: 'Box', costPrice: 90, retailPrice: 100, wholesalePrice: 80, netRateC2: 85, netRateC3: null }]);
    assert.deepStrictEqual(issues.map((i) => i.level), ['Wholesale', 'Price Level 2']);
    assert.strictEqual(belowCostIssues([{ unitName: 'P', costPrice: 0, retailPrice: 1 }]).length, 0);
  });

  await check('R06-02', 'the product form may still save a below-cost price (warning only), and says so', async () => {
    const r = await t.invoke('products:create', { name: 'Loss Leader', units: [{ unitName: 'Piece', conversionFactor: 1, retailPrice: 50, wholesalePrice: 50, costPrice: 70 }] });
    assert.ok(r.success, r.reason);
    assert.strictEqual(r.belowCost.length, 2);
  });

  await check('R06-03', 'a cashier cannot type a below-cost price (server price check refuses it)', async () => {
    const r = await sale([t.line(pen, 1, 50)], 'cashier');
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.priceChanged, true);
  });

  await check('R06-04', 'a cashier CAN sell at a below-cost price the Admin set on the product', async () => {
    const r = await sale([t.line(cheap, 1, 40)], 'cashier');
    assert.ok(r.success, r.reason);
  });

  await check('R06-05', 'the Admin price override below cost is allowed (the screen warned first)', async () => {
    const r = await sale([t.line(pen, 1, 55)], 'admin');
    assert.ok(r.success, r.reason);
    assert.strictEqual(t.db().prepare('SELECT unit_price FROM sale_items WHERE sale_id = ?').get(r.saleId).unit_price, 55);
  });
};
