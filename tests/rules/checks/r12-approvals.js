// Rule 12: Admin approval box on the cashier screen (discount over cap, selling
// without stock, older bills), approvals log, Stock to recount list.
const assert = require('assert');

module.exports = async (t, check) => {
  const d = t.db();
  const pen = t.addProduct({ name: 'Pen', retail: 100, cost: 60, stock: 2 });
  const sale = (extra, as = 'cashier') =>
    t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [t.line(pen, 1, 100)], discountAmount: 0, paidAmount: 1e5, paymentMethod: 'cash', ...extra }, as);
  const approve = (as = 'cashier', password = 'Admin@123', username = 'admin') => t.invoke('approvals:request', { username, password }, as);
  const sessionsBefore = d.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;

  await check('R12-01', 'discount above the cap asks for approval (nothing saved)', async () => {
    const r = await sale({ discountAmount: 20, paidAmount: 80 });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.needsApproval, true);
    assert.deepStrictEqual(r.approvalReasons, ['discount_over_cap']);
    assert.strictEqual(d.prepare('SELECT COUNT(*) AS n FROM sales').get().n, 0);
  });

  await check('R12-02', 'wrong Admin password / a cashier login are refused', async () => {
    assert.strictEqual((await approve('cashier', 'nope')).success, false);
    const asCashier = await approve('cashier', 'Cash@123', 'cashier2');
    assert.strictEqual(asCashier.success, false);
    assert.ok(/Only the Admin/.test(asCashier.reason));
  });

  await check('R12-03', 'with the Admin approval the discount sale saves and is logged (what, bill, cashier, admin)', async () => {
    const a = await approve();
    assert.ok(a.success && a.approvalToken, a.reason);
    const r = await sale({ discountAmount: 20, paidAmount: 80, approvalToken: a.approvalToken });
    assert.ok(r.success, r.reason);
    const log = d.prepare('SELECT * FROM approvals').all();
    assert.strictEqual(log.length, 1);
    assert.strictEqual(log[0].action, 'discount_over_cap');
    assert.strictEqual(log[0].sale_id, r.saleId);
    assert.strictEqual(log[0].cashier_id, t.users.cashier);
    assert.strictEqual(log[0].admin_id, t.users.admin);
    assert.ok(log[0].invoice_no && log[0].created_at);
  });

  await check('R12-04', 'an approval is used once, and only by the window that asked', async () => {
    const a = await approve();
    const other = await sale({ discountAmount: 20, paidAmount: 80, approvalToken: a.approvalToken }, 'cashier2');
    assert.strictEqual(other.needsApproval, true);
    const r1 = await sale({ discountAmount: 20, paidAmount: 80, approvalToken: a.approvalToken });
    assert.ok(r1.success, r1.reason);
    const r2 = await sale({ discountAmount: 20, paidAmount: 80, approvalToken: a.approvalToken });
    assert.strictEqual(r2.needsApproval, true);
  });

  await check('R12-05', 'the cashier stays signed in (no session made or ended by the approval box)', () => {
    assert.strictEqual(d.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, sessionsBefore);
    assert.strictEqual(d.prepare('SELECT COUNT(*) AS n FROM sessions WHERE is_revoked = 1').get().n, 0);
  });

  await check('R12-06', 'selling more than in stock asks for approval; nothing changes', async () => {
    const stock = t.stockOf(pen.variantId);
    const r = await sale({ items: [t.line(pen, stock + 3, 100)] });
    assert.strictEqual(r.needsApproval, true);
    assert.deepStrictEqual(r.approvalReasons, ['sell_without_stock']);
    assert.strictEqual(r.shortages[0].variantId, pen.variantId);
    assert.strictEqual(t.stockOf(pen.variantId), stock);
  });

  await check('R12-07', 'approved: stock goes below zero, item on Stock to recount, logged; stock = movements', async () => {
    const stock = t.stockOf(pen.variantId);
    const a = await approve();
    const r = await sale({ items: [t.line(pen, stock + 3, 100)], approvalToken: a.approvalToken });
    assert.ok(r.success, r.reason);
    assert.strictEqual(t.stockOf(pen.variantId), -3);
    assert.strictEqual(t.stockOf(pen.variantId), t.movementSum(pen.variantId));
    const rc = await t.invoke('stock:list-recount', {});
    assert.ok(rc.entries.some((e) => e.product_variant_id === pen.variantId && e.sale_id === r.saleId));
    assert.ok(d.prepare("SELECT 1 FROM approvals WHERE action = 'sell_without_stock' AND sale_id = ?").get(r.saleId));
    assert.ok((await t.invoke('dashboard:get-summary', {})).recountCount >= 1);
  });

  await check('R12-08', 'the Admin selling without stock confirms on screen (no approval box) and it is listed', async () => {
    const r = await sale({ items: [t.line(pen, 1, 100)] }, 'admin');
    assert.strictEqual(r.needsStockConfirm, true);
    const ok = await sale({ items: [t.line(pen, 1, 100)], allowNegativeStock: true }, 'admin');
    assert.ok(ok.success, ok.reason);
    assert.strictEqual(t.stockOf(pen.variantId), -4);
  });

  await check('R12-09', 'Stock to recount: mark counted (Admin only); below-zero Types still show', async () => {
    const rc = await t.invoke('stock:list-recount', {});
    for (const e of rc.entries) assert.ok((await t.invoke('stock:resolve-recount', { id: e.id })).success);
    assert.strictEqual((await t.invoke('stock:resolve-recount', { id: rc.entries[0].id }, 'cashier')).success, false);
    const after = await t.invoke('stock:list-recount', {});
    assert.strictEqual(after.entries.length, 0);
    assert.ok(after.belowZero.some((b) => b.product_variant_id === pen.variantId));
  });

  await check('R12-10', 'a bill from an earlier day: cashier edit/void need approval; approved void is logged', async () => {
    t.db().prepare("UPDATE product_variants SET stock_qty = 50 WHERE id = ?").run(pen.variantId);
    const s = await sale({ items: [t.line(pen, 1, 100)] });
    t.ageSale(s.saleId, 60 * 30);
    const e = await t.invoke('sales:update', { saleId: s.saleId, saleType: 'retail', customerId: null, items: [t.line(pen, 2, 100)], discountAmount: 0, paidAmount: 200, paymentMethod: 'cash' }, 'cashier');
    assert.strictEqual(e.needsApproval, true);
    const v = await t.invoke('sales:void', { saleId: s.saleId }, 'cashier');
    assert.strictEqual(v.needsApproval, true);
    const a = await approve();
    const v2 = await t.invoke('sales:void', { saleId: s.saleId, approvalToken: a.approvalToken }, 'cashier');
    assert.ok(v2.success, v2.reason);
    assert.ok(d.prepare("SELECT 1 FROM approvals WHERE action = 'void_old_bill' AND sale_id = ?").get(s.saleId));
  });

  await check('R12-11', 'lockout rules apply to the approval box (5 wrong tries lock the Admin username)', async () => {
    for (let i = 0; i < 5; i++) await approve('cashier', 'wrong-pass');
    const r = await approve('cashier', 'Admin@123');
    assert.strictEqual(r.success, false);
    assert.ok(/Too many wrong tries/.test(r.reason));
  });

  await check('R12-12', 'approvals log list is Admin-only; tables sync and are cleared by factory reset', async () => {
    assert.ok((await t.invoke('approvals:list', {})).rows.length >= 3);
    assert.strictEqual((await t.invoke('approvals:list', {}, 'cashier')).success, false);
    const cfg = t.m('sync/syncSchema').SYNC_TABLES;
    assert.strictEqual(cfg.approvals.kind, 'insert_only');
    assert.strictEqual(cfg.stock_recount.kind, 'upsert');
    const sys = require('fs').readFileSync(require('path').join(t.MAIN, 'ipc/system.ipc.js'), 'utf8');
    assert.ok(sys.includes("'approvals'") && sys.includes("'stock_recount'"));
  });
};
