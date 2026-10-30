// Rule 17: returns step 1 finds bills by item name/barcode, customer and date; no-bill return (Admin only).
const assert = require('assert');

module.exports = async (t, check) => {
  const d = t.db();
  const pen = t.addProduct({ name: 'Piano Gel Pen', retail: 100, cost: 60, stock: 50, barcode: '9001' });
  const book = t.addProduct({ name: 'Oxford Notebook', retail: 300, cost: 200, stock: 20 });
  const ahmed = t.addCustomer({ name: 'Ahmed Raza', phone: '03001234567' });
  const today = d.prepare("SELECT date('now','localtime') AS x").get().x;
  const mk = (items, extra = {}) =>
    t.invoke('sales:create', { saleType: 'retail', customerId: null, items, discountAmount: 0, paidAmount: 1e5, paymentMethod: 'cash', ...extra }, 'cashier');
  const s1 = await mk([t.line(pen, 2, 100)], { customerId: ahmed, paidAmount: 200 });
  const s2 = await mk([t.line(book, 1, 300)]);
  const s3 = await mk([t.line(pen, 5, 100)], { discountAmount: 50, paidAmount: 450 }); // effective 90 each
  const find = (search, extra = {}) => t.invoke('returns:search-sales', { search, ...extra });
  const ids = (r) => r.rows.map((x) => x.id);

  await check('R17-01', 'find bills by item name, search by barcode, by customer name/phone', async () => {
    assert.deepStrictEqual(ids(await find('gel pen')).sort(), [s1.saleId, s3.saleId].sort());
    assert.deepStrictEqual(ids(await find('9001')).sort(), [s1.saleId, s3.saleId].sort());
    assert.deepStrictEqual(ids(await find('Ahmed')), [s1.saleId]);
    assert.deepStrictEqual(ids(await find('0300123')), [s1.saleId]);
  });
  await check('R17-02', 'find bills by date (typed or range); voided bills are not offered', async () => {
    assert.strictEqual((await find(today)).rows.length, 3);
    const [y, m, dd] = today.split('-');
    assert.strictEqual((await find(`${dd}-${m}-${y}`)).rows.length, 3);
    assert.strictEqual((await find('', { dateFrom: '2000-01-01', dateTo: '2000-01-02' })).rows.length, 0);
    await t.invoke('sales:void', { saleId: s2.saleId }, 'admin');
    assert.ok(!ids(await find('Oxford')).includes(s2.saleId));
  });
  await check('R17-03', 'search and no-bill return are Admin-only', async () => {
    assert.strictEqual((await t.invoke('returns:search-sales', { search: 'pen' }, 'cashier')).success, false);
    assert.strictEqual((await t.invoke('returns:create-no-bill', { productVariantId: pen.variantId, productUnitId: pen.unitId, quantity: 1, reason: 'faulty' }, 'cashier')).success, false);
  });
  await check('R17-04', 'no-bill refund price = lowest real selling price in the last 30 days (after bill discount)', async () => {
    const p = await t.invoke('returns:no-bill-price', { productVariantId: pen.variantId, productUnitId: pen.unitId });
    assert.strictEqual(p.price, 90);
    assert.strictEqual(p.source, 'lowest_30_days');
    d.prepare("UPDATE sales SET created_at = datetime('now', '-40 days')").run();
    const old = await t.invoke('returns:no-bill-price', { productVariantId: pen.variantId, productUnitId: pen.unitId });
    assert.deepStrictEqual([old.price, old.source], [100, 'retail']);
    d.prepare("UPDATE sales SET created_at = datetime('now')").run();
  });
  let nb;
  await check('R17-05', 'no-bill return: cash refund, stock back, no sale link, no customer; whole numbers only', async () => {
    const stock = t.stockOf(pen.variantId);
    assert.strictEqual((await t.invoke('returns:create-no-bill', { productVariantId: pen.variantId, productUnitId: pen.unitId, quantity: 1.5, reason: 'faulty' })).success, false);
    nb = await t.invoke('returns:create-no-bill', { productVariantId: pen.variantId, productUnitId: pen.unitId, quantity: 2, reason: 'faulty', note: 'lost receipt' });
    assert.ok(nb.success, nb.reason);
    const r = d.prepare('SELECT * FROM sale_returns WHERE id = ?').get(nb.id);
    assert.deepStrictEqual([r.sale_id, r.customer_id, r.total_amount, r.cash_refund_amount, r.restocked], [null, null, 180, 180, 1]);
    const line = d.prepare('SELECT * FROM sale_return_items WHERE return_id = ?').get(nb.id);
    assert.deepStrictEqual([line.sale_item_id, line.product_variant_id, line.product_unit_id, line.quantity], [null, pen.variantId, pen.unitId, 2]);
    assert.strictEqual(t.stockOf(pen.variantId), stock + 2);
    assert.strictEqual(t.stockOf(pen.variantId), t.movementSum(pen.variantId));
  });
  await check('R17-06', "a no-bill return stays out of every bill's returnable quantities", async () => {
    const r = await t.invoke('returns:get-returnable', { saleId: s1.saleId });
    assert.strictEqual(r.lines[0].quantity_returned, 0);
    assert.strictEqual(r.lines[0].returnable, 2);
  });
  await check('R17-07', 'reports count it: Sales report returns, P&L, Home, Cashier performance; list/detail open it', async () => {
    const rep = await t.invoke('reports:get-sales-report', { filters: { dateFrom: today, dateTo: today } });
    assert.strictEqual(rep.returnsTotal, 180);
    const pl = await t.invoke('reports:get-profit-loss', { filters: { dateFrom: today, dateTo: today } });
    assert.strictEqual(pl.returnsTotal, 180);
    assert.strictEqual(pl.totals.cogs, 7 * 60 - 2 * 60);
    assert.strictEqual((await t.invoke('dashboard:get-summary', {})).todayReturns, 180);
    const cp = await t.invoke('reports:get-cashier-performance', { filters: { dateFrom: today, dateTo: today } });
    assert.strictEqual(cp.rows.find((x) => x.id === t.users.admin).returns_total, 180);
    const list = await t.invoke('returns:list', {});
    assert.ok(list.rows.some((x) => x.id === nb.id && x.sale_id === null));
    const det = await t.invoke('returns:get-detail', { id: nb.id });
    assert.ok(det.success && det.lines[0].item_name === 'Piano Gel Pen');
  });
  await check('R17-08', 'schema: returns allow no sale, sync schema allows it, old-style returns still work', async () => {
    const cfg = t.m('sync/syncSchema').SYNC_TABLES;
    assert.strictEqual(cfg.sale_returns.fks.sale_id.nullable, true);
    assert.strictEqual(cfg.sale_return_items.fks.sale_item_id.nullable, true);
    const item = d.prepare('SELECT id FROM sale_items WHERE sale_id = ?').get(s1.saleId);
    const r = await t.invoke('returns:create', { saleId: s1.saleId, reason: 'faulty', lines: [{ saleItemId: item.id, quantity: 1 }], cashRefund: 0 });
    assert.ok(r.success, r.reason);
    assert.ok(d.prepare("SELECT 1 FROM sync_outbox WHERE table_name = 'sale_returns'").get());
  });
};
