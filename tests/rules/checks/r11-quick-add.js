// Rule 11: add a missing item at the counter; Admin reviews (approve / merge).
const assert = require('assert');

module.exports = async (t, check) => {
  const d = t.db();
  const pen = t.addProduct({ name: 'Blue Gel Pen', retail: 50, cost: 30, stock: 10, barcode: '5000' });
  const be = t.m('ledger/balanceEngine');
  const today = d.prepare("SELECT date('now','localtime') AS dd").get().dd;

  await check('R11-01', 'permission "Add missing items at the counter" exists and is on by default for cashiers', () => {
    const def = t.m('../shared/permissionDefinitions').PERMISSION_DEFINITIONS.find((p) => p.key === 'add_missing_items');
    assert.ok(def && def.label === 'Add missing items at the counter' && def.defaultForNewCashier === true);
    const setup = require('fs').readFileSync(require('path').join(t.MAIN, 'setup/setupManager.js'), 'utf8');
    assert.ok(/NEW_CASHIER_PERMISSIONS = \[[^\]]*'add_missing_items'/.test(setup));
  });

  let added;
  await check('R11-02', 'a cashier adds an item: one Piece pack, retail = wholesale = price, flagged for review, no stock', async () => {
    added = await t.invoke('products:quick-add', { barcode: ' 8901234 \n', name: 'Glitter Glue', retailPrice: 75 }, 'cashier');
    assert.ok(added.success, added.reason);
    const p = d.prepare('SELECT * FROM products WHERE id = ?').get(added.productId);
    assert.strictEqual(p.needs_review, 1);
    assert.strictEqual(p.created_via, 'quick_add');
    const units = d.prepare('SELECT * FROM product_units WHERE product_id = ?').all(added.productId);
    assert.strictEqual(units.length, 1);
    assert.deepStrictEqual([units[0].unit_name, units[0].conversion_factor, units[0].retail_price, units[0].wholesale_price, units[0].cost_price], ['Piece', 1, 75, 75, 0]);
    const v = d.prepare('SELECT * FROM product_variants WHERE id = ?').get(added.variantId);
    assert.strictEqual(v.barcode, '8901234');
    assert.strictEqual(v.stock_qty, 0);
  });

  await check('R11-03', 'name required, price > 0, barcode must be unique', async () => {
    assert.strictEqual((await t.invoke('products:quick-add', { name: '  ', retailPrice: 5 }, 'cashier')).success, false);
    assert.strictEqual((await t.invoke('products:quick-add', { name: 'X', retailPrice: 0 }, 'cashier')).success, false);
    assert.strictEqual((await t.invoke('products:quick-add', { name: 'X', retailPrice: -3 }, 'cashier')).success, false);
    const dup = await t.invoke('products:quick-add', { barcode: '5000', name: 'Pen copy', retailPrice: 5 }, 'cashier');
    assert.strictEqual(dup.success, false);
    assert.ok(/Blue Gel Pen/.test(dup.reason));
  });

  await check('R11-04', 'similar names are offered (pick the real item instead)', async () => {
    const r = await t.invoke('products:find-similar', { name: 'gel pen' }, 'cashier');
    assert.ok(r.matches.some((m) => m.name === 'Blue Gel Pen' && m.variantId === pen.variantId));
  });

  await check('R11-05', 'without the permission the cashier is refused', async () => {
    d.prepare("DELETE FROM user_permissions WHERE user_id = ? AND permission_key = 'add_missing_items'").run(t.users.cashier2);
    const r = await t.invoke('products:quick-add', { name: 'Y', retailPrice: 5 }, 'cashier2');
    assert.strictEqual(r.success, false);
  });

  let sale;
  await check('R11-06', 'the new item sells with no stock (stock goes negative, = sum of movements)', async () => {
    sale = await t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [{ productVariantId: added.variantId, productUnitId: added.unitId, quantity: 3, focQuantity: 0, unitPrice: 75, lineTotal: 225 }], discountAmount: 0, paidAmount: 225, paymentMethod: 'cash' }, 'cashier');
    assert.ok(sale.success, sale.reason);
    assert.strictEqual(t.stockOf(added.variantId), -3);
    assert.strictEqual(t.stockOf(added.variantId), t.movementSum(added.variantId));
  });

  await check('R11-07', 'Admin list shows it with a count; Home summary counts it', async () => {
    const l = await t.invoke('products:list-needs-review', {});
    const row = l.rows.find((r) => r.id === added.productId);
    assert.ok(row && row.buyingPriceMissing && row.sold_qty === 3 && row.stock === -3);
    assert.strictEqual((await t.invoke('dashboard:get-summary', {})).needsReviewCount, 1);
    assert.strictEqual((await t.invoke('products:list-needs-review', {}, 'cashier')).success, false);
  });

  await check('R11-08', 'P&L and the stock report flag "buying price missing" instead of a silent 0', async () => {
    const pl = await t.invoke('reports:get-profit-loss', { filters: { dateFrom: today, dateTo: today } });
    assert.strictEqual(pl.costMissing.items, 1);
    assert.strictEqual(pl.costMissing.revenue, 225);
    assert.ok(pl.summary.some((s) => /buying price missing/i.test(s.label)));
    const st = await t.invoke('reports:get-stock-report', { filters: {} });
    assert.ok(st.rows.find((r) => r.id === added.productId).cost_missing);
    assert.ok(!st.rows.find((r) => r.id === pen.productId).cost_missing);
  });

  await check('R11-09', 'Approve is refused until a buying price is set, then clears the flag', async () => {
    assert.strictEqual((await t.invoke('products:approve-review', { productId: added.productId })).success, false);
    d.prepare('UPDATE product_units SET cost_price = 40 WHERE product_id = ?').run(added.productId);
    const ok = await t.invoke('products:approve-review', { productId: added.productId });
    assert.ok(ok.success, ok.reason);
    assert.strictEqual(d.prepare('SELECT needs_review FROM products WHERE id = ?').get(added.productId).needs_review, 0);
  });

  await check('R11-10', 'Merge moves sales and stock to the real product, then switches the item off', async () => {
    const q = await t.invoke('products:quick-add', { barcode: '777', name: 'blue pen gel', retailPrice: 50 }, 'cashier');
    const s = await t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [{ productVariantId: q.variantId, productUnitId: q.unitId, quantity: 2, focQuantity: 0, unitPrice: 50, lineTotal: 100 }], discountAmount: 0, paidAmount: 100, paymentMethod: 'cash' }, 'cashier');
    assert.ok(s.success, s.reason);
    const penStock = t.stockOf(pen.variantId);
    const salesBefore = (await t.invoke('reports:get-sales-report', { filters: { dateFrom: today, dateTo: today } })).netRevenue;
    const m = await t.invoke('products:merge-review', { productId: q.productId, intoVariantId: pen.variantId, intoUnitId: pen.unitId });
    assert.ok(m.success, m.reason);
    const line = d.prepare('SELECT * FROM sale_items WHERE sale_id = ?').get(s.saleId);
    assert.deepStrictEqual([line.product_id, line.product_variant_id, line.product_unit_id], [pen.productId, pen.variantId, pen.unitId]);
    assert.strictEqual(t.stockOf(pen.variantId), penStock - 2); // the -2 the item had moves across
    assert.strictEqual(t.stockOf(q.variantId), 0);
    assert.strictEqual(t.stockOf(pen.variantId), t.movementSum(pen.variantId));
    const src = d.prepare('SELECT is_active, needs_review, merged_into_product_id FROM products WHERE id = ?').get(q.productId);
    assert.deepStrictEqual(src, { is_active: 0, needs_review: 0, merged_into_product_id: pen.productId });
    const after = (await t.invoke('reports:get-sales-report', { filters: { dateFrom: today, dateTo: today } })).netRevenue;
    assert.strictEqual(after, salesBefore); // money unchanged by a merge
    const st = await t.invoke('stock:get-product-stats', { productId: pen.productId });
    assert.strictEqual(st.salesCount, 1);
    const outbox = d.prepare("SELECT 1 FROM sync_outbox WHERE table_name = 'sale_items' AND operation = 'update'").get();
    assert.ok(outbox, 'the moved sale line must sync');
  });

  await check('R11-11', 'quick-added items never change any balance by themselves', () => {
    assert.strictEqual(Object.keys(be.getBalancesForCustomers(d, [])).length, 0);
    assert.strictEqual(t.m('sync/syncSchema').SYNC_TABLES.products.fks.merged_into_product_id.table, 'products');
  });
};
