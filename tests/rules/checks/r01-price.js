// Rule 1: the server re-resolves every line price; mismatch refused unless Admin.
const assert = require('assert');

module.exports = async (t, check) => {
  const pen = t.addProduct({ name: 'Pen', retail: 100, wholesale: 90, cost: 60, stock: 50, box: { factor: 10, retail: 900, wholesale: 850 }, netC1: 80 });
  const ahmed = t.addCustomer({ name: 'Ahmed', tier: 'C1' });
  const whole = t.addCustomer({ name: 'Wholesaler', type: 'wholesale' });
  const sale = (lines, extra = {}, as = 'cashier') =>
    t.invoke('sales:create', { saleType: 'retail', customerId: null, items: lines, discountAmount: 0, paidAmount: 1e6, paymentMethod: 'cash', ...extra }, as);
  const count = () => t.db().prepare('SELECT COUNT(*) AS n FROM sales').get().n;

  await check('R01-01', 'cashier at the engine price is saved with that price', async () => {
    const r = await sale([t.line(pen, 2, 100)], { paidAmount: 200 });
    assert.ok(r.success, r.reason);
    const it = t.db().prepare('SELECT unit_price, line_total FROM sale_items WHERE sale_id = ?').get(r.saleId);
    assert.strictEqual(it.unit_price, 100);
    assert.strictEqual(it.line_total, 200);
  });

  await check('R01-02', 'cashier sending a lower price is refused, nothing saved, stock untouched', async () => {
    const before = count();
    const stock = t.stockOf(pen.variantId);
    const r = await sale([t.line(pen, 1, 50)], { paidAmount: 50 });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.priceChanged, true);
    assert.strictEqual(r.changedLines[0].price, 100);
    assert.strictEqual(count(), before);
    assert.strictEqual(t.stockOf(pen.variantId), stock);
  });

  await check('R01-03', 'a difference within 0.01 is accepted and the server price is stored', async () => {
    const r = await sale([t.line(pen, 1, 100.005)], { paidAmount: 100.01 });
    assert.ok(r.success, r.reason);
    const it = t.db().prepare('SELECT unit_price FROM sale_items WHERE sale_id = ?').get(r.saleId);
    assert.strictEqual(it.unit_price, 100);
    const s = t.db().prepare('SELECT total_amount FROM sales WHERE id = ?').get(r.saleId);
    assert.strictEqual(s.total_amount, 100);
  });

  await check('R01-04', 'Admin manual price override is stored as typed', async () => {
    const r = await sale([t.line(pen, 3, 80)], { paidAmount: 240 }, 'admin');
    assert.ok(r.success, r.reason);
    const it = t.db().prepare('SELECT unit_price, line_total FROM sale_items WHERE sale_id = ?').get(r.saleId);
    assert.strictEqual(it.unit_price, 80);
    assert.strictEqual(it.line_total, 240);
  });

  await check('R01-05', 'price level (C1 net rate) customer: retail refused, net rate accepted', async () => {
    const bad = await sale([t.line(pen, 1, 100)], { customerId: ahmed, paidAmount: 100 });
    assert.strictEqual(bad.success, false);
    assert.strictEqual(bad.changedLines[0].price, 80);
    const ok = await sale([t.line(pen, 1, 80)], { customerId: ahmed, paidAmount: 80 });
    assert.ok(ok.success, ok.reason);
  });

  await check('R01-06', 'wholesale customer gets the wholesale price; retail price refused', async () => {
    const bad = await sale([t.line(pen, 1, 100)], { customerId: whole, saleType: 'wholesale', paidAmount: 100 });
    assert.strictEqual(bad.success, false);
    const ok = await sale([t.line(pen, 1, 90)], { customerId: whole, saleType: 'wholesale', paidAmount: 90 });
    assert.ok(ok.success, ok.reason);
  });

  await check('R01-07', 'pack size price is checked per pack size (Box 900)', async () => {
    const bad = await sale([t.line(pen, 1, 100, { unitId: pen.boxUnitId })], { paidAmount: 100 });
    assert.strictEqual(bad.success, false);
    const ok = await sale([t.line(pen, 1, 900, { unitId: pen.boxUnitId })], { paidAmount: 900 });
    assert.ok(ok.success, ok.reason);
  });

  await check('R01-08', 'cashier editing a bill keeps its stored price after the Admin changed the product price', async () => {
    const r = await sale([t.line(pen, 1, 100)], { paidAmount: 100 });
    t.db().prepare('UPDATE product_units SET retail_price = 120 WHERE id = ?').run(pen.unitId);
    const u = await t.invoke('sales:update', { saleId: r.saleId, saleType: 'retail', customerId: null, items: [t.line(pen, 2, 100)], discountAmount: 0, paidAmount: 200, paymentMethod: 'cash' }, 'cashier');
    assert.ok(u.success, u.reason);
    const it = t.db().prepare('SELECT unit_price FROM sale_items WHERE sale_id = ?').get(r.saleId);
    assert.strictEqual(it.unit_price, 100);
    // ...but a brand-new sale must use the new price
    const fresh = await sale([t.line(pen, 1, 100)], { paidAmount: 100 });
    assert.strictEqual(fresh.success, false);
    t.db().prepare('UPDATE product_units SET retail_price = 100 WHERE id = ?').run(pen.unitId);
  });

  await check('R01-09', 'edit that changes the customer cannot keep the old price', async () => {
    const r = await sale([t.line(pen, 1, 100)], { paidAmount: 100 });
    const u = await t.invoke('sales:update', { saleId: r.saleId, saleType: 'retail', customerId: ahmed, items: [t.line(pen, 1, 100)], discountAmount: 0, paidAmount: 100, paymentMethod: 'cash' }, 'cashier');
    assert.strictEqual(u.success, false);
    assert.strictEqual(u.priceChanged, true);
  });

  await check('R01-10', 'a pack size that does not belong to the item is refused', async () => {
    const other = t.addProduct({ name: 'Other', retail: 5, stock: 10 });
    const r = await sale([{ ...t.line(pen, 1, 5), productUnitId: other.unitId }], { paidAmount: 5 });
    assert.strictEqual(r.success, false);
  });

  await check('R01-11', 'quick bill / sale totals: subtotal and total come from server prices', async () => {
    const r = await sale([t.line(pen, 2, 100), t.line(pen, 1, 900, { unitId: pen.boxUnitId })], { discountAmount: 50, paidAmount: 1050 });
    assert.ok(r.success, r.reason);
    const s = t.db().prepare('SELECT subtotal, total_amount FROM sales WHERE id = ?').get(r.saleId);
    assert.strictEqual(s.subtotal, 1100);
    assert.strictEqual(s.total_amount, 1050);
  });
};
