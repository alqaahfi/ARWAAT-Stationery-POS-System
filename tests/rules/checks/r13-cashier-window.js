// Rule 13: cashier edits/voids — own bills only, within 10 minutes; later only with Admin approval.
// Admin unrestricted except bills with returns.
const assert = require('assert');

module.exports = async (t, check) => {
  const d = t.db();
  const pen = t.addProduct({ name: 'Pen', retail: 100, cost: 60, stock: 100 });
  const mk = (as = 'cashier') =>
    t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [t.line(pen, 1, 100)], discountAmount: 0, paidAmount: 100, paymentMethod: 'cash' }, as);
  const upd = (saleId, as, extra = {}) =>
    t.invoke('sales:update', { saleId, saleType: 'retail', customerId: null, items: [t.line(pen, 2, 100)], discountAmount: 0, paidAmount: 200, paymentMethod: 'cash', ...extra }, as);

  await check('R13-01', 'a cashier edits and voids their own bill within 10 minutes (no approval)', async () => {
    const a = await mk();
    t.ageSale(a.saleId, 9);
    assert.ok((await upd(a.saleId, 'cashier')).success);
    const b = await mk();
    t.ageSale(b.saleId, 9);
    assert.ok((await t.invoke('sales:void', { saleId: b.saleId }, 'cashier')).success);
  });

  await check('R13-02', 'after 10 minutes the same cashier needs the Admin approval (edit and void)', async () => {
    const a = await mk();
    t.ageSale(a.saleId, 11);
    const e = await upd(a.saleId, 'cashier');
    assert.strictEqual(e.needsApproval, true);
    assert.deepStrictEqual(e.approvalReasons, ['change_old_bill']);
    assert.ok(/10 minutes/.test(e.reason));
    const v = await t.invoke('sales:void', { saleId: a.saleId }, 'cashier');
    assert.strictEqual(v.needsApproval, true);
    const tok = (await t.invoke('approvals:request', { username: 'admin', password: 'Admin@123' }, 'cashier')).approvalToken;
    const ok = await upd(a.saleId, 'cashier', { approvalToken: tok });
    assert.ok(ok.success, ok.reason);
    assert.ok(d.prepare("SELECT 1 FROM approvals WHERE action = 'change_old_bill' AND sale_id = ?").get(a.saleId));
  });

  await check('R13-03', "a cashier can never change another cashier's bill (even with an approval)", async () => {
    const a = await mk('cashier2');
    const tok = (await t.invoke('approvals:request', { username: 'admin', password: 'Admin@123' }, 'cashier')).approvalToken;
    const e = await upd(a.saleId, 'cashier', { approvalToken: tok });
    assert.strictEqual(e.success, false);
    assert.ok(/own bills/.test(e.reason));
    const v = await t.invoke('sales:void', { saleId: a.saleId, approvalToken: tok }, 'cashier');
    assert.strictEqual(v.success, false);
    const g = await t.invoke('sales:get-for-edit', { saleId: a.saleId }, 'cashier');
    assert.strictEqual(g.success, false);
  });

  await check('R13-04', 'opening an older own bill for edit works but says approval will be needed', async () => {
    const a = await mk();
    t.ageSale(a.saleId, 30);
    const g = await t.invoke('sales:get-for-edit', { saleId: a.saleId }, 'cashier');
    assert.ok(g.success && g.needsApproval === true);
    const fresh = await mk();
    assert.strictEqual((await t.invoke('sales:get-for-edit', { saleId: fresh.saleId }, 'cashier')).needsApproval, false);
  });

  await check('R13-05', 'the Admin changes any bill at any age without approval', async () => {
    const a = await mk('cashier2');
    t.ageSale(a.saleId, 60 * 24 * 40);
    assert.ok((await upd(a.saleId, 'admin')).success);
    assert.ok((await t.invoke('sales:void', { saleId: a.saleId }, 'admin')).success);
  });

  await check('R13-06', 'bills with returns stay locked for everyone (Admin too)', async () => {
    const a = await mk();
    const item = d.prepare('SELECT id FROM sale_items WHERE sale_id = ?').get(a.saleId);
    assert.ok((await t.invoke('returns:create', { saleId: a.saleId, reason: 'faulty', lines: [{ saleItemId: item.id, quantity: 1 }] })).success);
    assert.strictEqual((await upd(a.saleId, 'admin')).success, false);
    assert.strictEqual((await t.invoke('sales:void', { saleId: a.saleId }, 'admin')).success, false);
  });

  await check('R13-07', 'stock stays equal to the sum of movements after all those edits/voids', () => {
    assert.strictEqual(t.stockOf(pen.variantId), t.movementSum(pen.variantId));
  });
};
