// Rule 3: positive whole numbers only, for every quantity (server side).
const assert = require('assert');

module.exports = async (t, check) => {
  const pen = t.addProduct({ name: 'Pen', retail: 10, stock: 100 });
  const sup = t.addSupplier({ name: 'Lahore Stationers' });
  const sale = (qty, foc = 0) =>
    t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [t.line(pen, qty, 10, { foc })], discountAmount: 0, paidAmount: qty * 10, paymentMethod: 'cash' }, 'cashier');
  const isWholeMsg = (r) => r.success === false && /whole numbers/.test(r.reason);

  await check('R03-01', 'sale quantity 1.5 refused, stock untouched', async () => {
    assert.ok(isWholeMsg(await sale(1.5)));
    assert.strictEqual(t.stockOf(pen.variantId), 100);
  });
  await check('R03-02', 'sale free (FOC) quantity 0.5 refused', async () => assert.ok(isWholeMsg(await sale(1, 0.5))));
  await check('R03-03', 'sale quantity 0 / negative refused, whole number accepted', async () => {
    assert.strictEqual((await sale(0)).success, false);
    assert.strictEqual((await sale(-2)).success, false);
    const ok = await sale(2, 1);
    assert.ok(ok.success, ok.reason);
    assert.strictEqual(t.stockOf(pen.variantId), 97);
  });
  await check('R03-04', 'purchase quantity 2.5 and free 0.5 refused', async () => {
    const base = { supplierId: sup, discountAmount: 0, paidAmount: 0, paymentMethod: 'cash' };
    const a = await t.invoke('purchases:create', { ...base, items: [{ productVariantId: pen.variantId, productUnitId: pen.unitId, quantity: 2.5, unitCost: 5 }] });
    const b = await t.invoke('purchases:create', { ...base, items: [{ productVariantId: pen.variantId, productUnitId: pen.unitId, quantity: 2, focQuantity: 0.5, unitCost: 5 }] });
    assert.ok(isWholeMsg(a) && isWholeMsg(b));
    assert.strictEqual(t.stockOf(pen.variantId), 97);
  });
  await check('R03-05', 'stock add / remove / fix count with 1.5 refused', async () => {
    const add = await t.invoke('stock:add', { lines: [{ variantId: pen.variantId, unitId: pen.unitId, quantity: 1.5 }] });
    const rem = await t.invoke('stock:remove', { lines: [{ variantId: pen.variantId, unitId: pen.unitId, quantity: 1.5 }], reasonCode: 'damaged' });
    const adj = await t.invoke('stock:adjust', { productVariantId: pen.variantId, direction: 'decrease', quantity: 1.5, reasonCode: 'recount' });
    assert.strictEqual(add.success, false);
    assert.strictEqual(rem.success, false);
    assert.ok(isWholeMsg(adj));
    assert.strictEqual(t.stockOf(pen.variantId), 97);
  });
  await check('R03-06', 'return quantity 0.5 refused', async () => {
    const s = await sale(3);
    const item = t.db().prepare('SELECT id FROM sale_items WHERE sale_id = ?').get(s.saleId);
    const r = await t.invoke('returns:create', { saleId: s.saleId, reason: 'faulty', lines: [{ saleItemId: item.id, quantity: 0.5 }] });
    assert.ok(isWholeMsg(r));
  });
  await check('R03-07', 'product starting stock 2.5 refused', async () => {
    const r = await t.invoke('products:create', { name: 'Half', units: [{ unitName: 'Piece', conversionFactor: 1, retailPrice: 5, wholesalePrice: 5, costPrice: 3 }], standardStartingStock: 2.5 });
    assert.strictEqual(r.success, false);
    assert.ok(/whole numbers/.test(r.reason));
  });
};
