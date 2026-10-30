// Stage 1 counter anomalies: server-side verification for BRIEF.md section 2.
const assert = require('assert');

module.exports = async (t, check) => {
  const pen = t.addProduct({ name: 'Pen', retail: 100, wholesale: 90, cost: 60, stock: 500, barcode: 'PEN-01' });
  const expensive = t.addProduct({ name: 'Projector', retail: 60000, wholesale: 55000, cost: 40000, stock: 10, barcode: 'PROJ-1' });
  const ahmed = t.addCustomer({ name: 'Ahmed', tier: 'C1' });

  const sale = (lines, extra = {}, as = 'cashier') =>
    t.invoke('sales:create', { saleType: 'retail', customerId: null, items: lines, discountAmount: 0, paidAmount: 1e7, paymentMethod: 'cash', ...extra }, as);

  await check('R18-01', 'scanner input with leading/trailing spaces, newline, or lowercase matches the barcode', async () => {
    const r1 = await t.invoke('sales:get-variant-by-barcode', { barcode: '  PEN-01 \r\n' }, 'cashier');
    assert.ok(r1 && r1.variantId === pen.variantId);
    const r2 = await t.invoke('sales:get-variant-by-barcode', { barcode: 'pen-01' }, 'cashier');
    assert.ok(r2 && r2.variantId === pen.variantId);
    const r3 = await t.invoke('sales:get-variant-by-barcode', { barcode: '\tPen-01\n' }, 'cashier');
    assert.ok(r3 && r3.variantId === pen.variantId);
  });

  await check('R18-02', 'barcode that equals another product name: barcode lookup returns the barcoded item, search returns both', async () => {
    const codeItem = t.addProduct({ name: 'Special Marker', retail: 120, stock: 20, barcode: 'NOTEBOOK' });
    const nameItem = t.addProduct({ name: 'NOTEBOOK', retail: 80, stock: 20, barcode: 'NB-999' });
    const byScan = await t.invoke('sales:get-variant-by-barcode', { barcode: 'NOTEBOOK' }, 'cashier');
    assert.ok(byScan && byScan.variantId === codeItem.variantId);
    const bySearch = await t.invoke('sales:search-products-grouped', { query: 'NOTEBOOK' }, 'cashier');
    const ids = bySearch.map((g) => g.productId);
    assert.ok(ids.includes(codeItem.productId) && ids.includes(nameItem.productId));
  });

  await check('R18-03', 'walk-in customer paying less than total is blocked with a clear message', async () => {
    const r = await sale([t.line(pen, 2, 100)], { paidAmount: 150 });
    assert.strictEqual(r.success, false);
    assert.ok(/walk-in|customer/i.test(r.reason), r.reason);
  });

  await check('R18-04', 'quantity > 100 asks for confirmation before saving and succeeds once confirmed', async () => {
    const unconfirmed = await sale([t.line(pen, 101, 100)], { paidAmount: 10100 });
    assert.strictEqual(unconfirmed.success, false);
    assert.strictEqual(unconfirmed.needsLargeConfirm, true);
    assert.ok(/101/.test(unconfirmed.reason), unconfirmed.reason);

    const confirmed = await sale([t.line(pen, 101, 100)], { paidAmount: 10100, allowLargeQty: true });
    assert.ok(confirmed.success, confirmed.reason);
  });

  await check('R18-05', 'line total > Rs 100,000 asks for confirmation before saving and succeeds once confirmed', async () => {
    const unconfirmed = await sale([t.line(expensive, 2, 60000)], { paidAmount: 120000 });
    assert.strictEqual(unconfirmed.success, false);
    assert.strictEqual(unconfirmed.needsLargeConfirm, true);
    assert.ok(/120000/.test(unconfirmed.reason), unconfirmed.reason);

    const confirmed = await sale([t.line(expensive, 2, 60000)], { paidAmount: 120000, allowLargeQty: true });
    assert.ok(confirmed.success, confirmed.reason);
  });

  await check('R18-06', 'product or variant deactivated while in the cart is blocked with a clear message', async () => {
    const temp = t.addProduct({ name: 'Temp Pencil', retail: 20, stock: 50 });
    t.db().prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(temp.productId);
    const r1 = await sale([t.line(temp, 1, 20)], { paidAmount: 20 });
    assert.strictEqual(r1.success, false);
    assert.ok(/switched off/i.test(r1.reason), r1.reason);

    t.db().prepare('UPDATE products SET is_active = 1 WHERE id = ?').run(temp.productId);
    t.db().prepare('UPDATE product_variants SET is_active = 0 WHERE id = ?').run(temp.variantId);
    const r2 = await sale([t.line(temp, 1, 20)], { paidAmount: 20 });
    assert.strictEqual(r2.success, false);
    assert.ok(/switched off/i.test(r2.reason), r2.reason);
  });

  await check('R18-07', 'customer deactivated while in the cart is blocked with a clear message', async () => {
    const inactiveCust = t.addCustomer({ name: 'Old Account' });
    t.db().prepare('UPDATE customers SET is_active = 0 WHERE id = ?').run(inactiveCust);
    const r = await sale([t.line(pen, 1, 100)], { customerId: inactiveCust, paidAmount: 100 });
    assert.strictEqual(r.success, false);
    assert.ok(/Customer "Old Account" has been switched off/i.test(r.reason), r.reason);
  });

  await check('R18-08', 'price changed by Admin while bill is open: cashier save returns priceChanged with new price', async () => {
    const notebook = t.addProduct({ name: 'Spiral Notebook', retail: 150, stock: 30 });
    // Admin changes retail price from 150 to 180 while cashier still has 150 in cart
    t.db().prepare('UPDATE product_units SET retail_price = 180 WHERE id = ?').run(notebook.unitId);
    const r1 = await sale([t.line(notebook, 2, 150)], { paidAmount: 300 }, 'cashier');
    assert.strictEqual(r1.success, false);
    assert.strictEqual(r1.priceChanged, true);
    assert.strictEqual(r1.changedLines[0].price, 180);
    // Retrying with the updated price succeeds
    const r2 = await sale([t.line(notebook, 2, 180)], { paidAmount: 360 }, 'cashier');
    assert.ok(r2.success, r2.reason);
  });

  await check('R18-09', 'two cashiers selling the last unit: first succeeds, second requires Admin approval and logs stock to recount', async () => {
    const rare = t.addProduct({ name: 'Limited Fountain Pen', retail: 500, stock: 1 });
    const c1 = await sale([t.line(rare, 1, 500)], { paidAmount: 500 }, 'cashier');
    assert.ok(c1.success, c1.reason);
    assert.strictEqual(t.stockOf(rare.variantId), 0);

    const c2 = await sale([t.line(rare, 1, 500)], { paidAmount: 500 }, 'cashier2');
    assert.strictEqual(c2.success, false);
    assert.strictEqual(c2.needsApproval, true);
    assert.ok(c2.approvalReasons.includes('sell_without_stock'));

    const app = await t.invoke('approvals:request', { username: 'admin', password: 'Admin@123' }, 'cashier2');
    assert.ok(app.success);
    const c2Approved = await sale([t.line(rare, 1, 500)], { paidAmount: 500, approvalToken: app.approvalToken }, 'cashier2');
    assert.ok(c2Approved.success, c2Approved.reason);
    assert.strictEqual(t.stockOf(rare.variantId), -1);

    const recount = t.db().prepare('SELECT * FROM stock_recount WHERE product_variant_id = ? AND resolved_at IS NULL').get(rare.variantId);
    assert.ok(recount, 'expected stock_recount entry for negative stock sale');
  });

  await check('R18-10', 'printer off / unconfigured: sale remains saved, print fails with clear message, original print status preserved', async () => {
    const s = await sale([t.line(pen, 1, 100)], { customerId: ahmed, paidAmount: 100 }, 'cashier');
    assert.ok(s.success, s.reason);
    // No thermal printer configured -> printSale fails cleanly without throwing or losing the sale
    const p = await t.invoke('printing:print-sale', { saleId: s.saleId, printType: 'retail-thermal', showDues: false }, 'cashier');
    assert.strictEqual(p.success, false);
    assert.ok(/printer/i.test(p.reason), p.reason);
    const row = t.db().prepare('SELECT id, is_voided FROM sales WHERE id = ?').get(s.saleId);
    assert.ok(row && row.is_voided === 0);
    const prints = t.db().prepare('SELECT COUNT(*) AS n FROM sale_prints WHERE sale_id = ?').get(s.saleId).n;
    assert.strictEqual(prints, 0);
    const receipt = await t.invoke('sales:get-receipt-data', { saleId: s.saleId }, 'cashier');
    assert.strictEqual(receipt.duplicate, false);
  });
};
