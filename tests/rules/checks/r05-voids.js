// Rule 5: voids are kept (is_voided) and count as ZERO everywhere.
const assert = require('assert');

module.exports = async (t, check) => {
  const pen = t.addProduct({ name: 'Pen', retail: 100, cost: 60, stock: 50 });
  const book = t.addProduct({ name: 'Book', retail: 500, cost: 300, stock: 20 });
  const ahmed = t.addCustomer({ name: 'Ahmed', opening: 200 });
  const d = t.db();
  const today = d.prepare("SELECT date('now','localtime') AS d").get().d;
  const range = { dateFrom: today, dateTo: today };
  const be = t.m('ledger/balanceEngine');

  const mk = (items, extra) =>
    t.invoke('sales:create', { saleType: 'retail', customerId: null, items, discountAmount: 0, paidAmount: 0, paymentMethod: 'cash', ...extra }, 'cashier');

  // A: Ahmed, book 2 x 500 = 1000, paid 400  (to be voided)
  const A = await mk([t.line(book, 2, 500)], { customerId: ahmed, paidAmount: 400 });
  // B: walk-in, pen 3 x 100 = 300 paid (stays)
  const B = await mk([t.line(pen, 3, 100)], { paidAmount: 300 });
  // C: Ahmed, pen 1 x 100, paid 100 (stays)
  const C = await mk([t.line(pen, 1, 100)], { customerId: ahmed, paidAmount: 100 });
  assert.ok(A.success && B.success && C.success, 'setup sales');
  const balBefore = be.getCustomerBalance(d, ahmed); // 200 + 1000 - 400 + 100 - 100 = 800
  const salesReportBefore = await t.invoke('reports:get-sales-report', { filters: range });
  const outboxBefore = d.prepare('SELECT MAX(id) AS m FROM sync_outbox').get().m;
  const invoiceA = d.prepare('SELECT invoice_no FROM sales WHERE id = ?').get(A.saleId).invoice_no;

  const V = await t.invoke('sales:void', { saleId: A.saleId }, 'cashier');

  await check('R05-01', 'void keeps the bill: is_voided, voided_at, voided_by; lines kept; its payment marked voided', () => {
    assert.ok(V.success, V.reason);
    const s = d.prepare('SELECT * FROM sales WHERE id = ?').get(A.saleId);
    assert.strictEqual(s.is_voided, 1);
    assert.ok(s.voided_at);
    assert.strictEqual(s.voided_by, t.users.cashier);
    assert.strictEqual(d.prepare('SELECT COUNT(*) AS n FROM sale_items WHERE sale_id = ?').get(A.saleId).n, 1);
    const p = d.prepare('SELECT * FROM payments WHERE sale_id = ?').all(A.saleId);
    assert.strictEqual(p.length, 1);
    assert.strictEqual(p[0].is_voided, 1);
  });

  await check('R05-02', 'stock goes back; stock = sum of movements', () => {
    assert.strictEqual(t.stockOf(book.variantId), 20);
    assert.strictEqual(t.stockOf(book.variantId), t.movementSum(book.variantId));
    assert.strictEqual(t.stockOf(pen.variantId), t.movementSum(pen.variantId));
  });

  await check('R05-03', 'balanceEngine (single + batch) drops the voided bill and its payment', () => {
    assert.strictEqual(balBefore, 800);
    assert.strictEqual(be.getCustomerBalance(d, ahmed), 200);
    assert.strictEqual(be.getBalancesForCustomers(d, [ahmed])[ahmed], 200);
  });

  await check('R05-04', 'customer ledger timeline ends on the same balance and has no voided rows', async () => {
    const l = await t.invoke('customers:get-ledger', { id: ahmed });
    assert.strictEqual(l.balance, 200);
    assert.strictEqual(l.transactions[l.transactions.length - 1].runningBalance, 200);
    assert.ok(!l.transactions.some((x) => x.reference === invoiceA));
  });

  await check('R05-05', 'Sales report: net, count, rows exclude the voided bill; rows add up', async () => {
    const r = await t.invoke('reports:get-sales-report', { filters: range });
    assert.strictEqual(salesReportBefore.netRevenue, 1400);
    assert.strictEqual(r.netRevenue, 400);
    assert.strictEqual(r.salesCount, 2);
    assert.ok(!r.rows.some((x) => x.id === A.saleId));
    assert.strictEqual(r.rows.reduce((s, x) => s + x.total_amount, 0), r.grossRevenue);
  });

  await check('R05-06', 'Profit & Loss: revenue and cost of goods exclude the voided bill', async () => {
    const r = await t.invoke('reports:get-profit-loss', { filters: range });
    assert.strictEqual(r.totals.revenue, 400);
    assert.strictEqual(r.totals.cogs, 4 * 60);
  });

  await check('R05-07', 'Cashier performance excludes the voided bill', async () => {
    const r = await t.invoke('reports:get-cashier-performance', { filters: range });
    const row = r.rows.find((x) => x.id === t.users.cashier);
    assert.strictEqual(row.sales_count, 2);
    assert.strictEqual(row.total_revenue, 400);
  });

  await check('R05-08', 'Home: today total, count, recent sales, receivables and the chart exclude it', async () => {
    const s = await t.invoke('dashboard:get-summary', {});
    assert.strictEqual(s.todaySalesTotal, 400);
    assert.strictEqual(s.todaySalesCount, 2);
    assert.ok(!s.recentSales.some((x) => x.id === A.saleId));
    assert.strictEqual(s.outstandingReceivables, 200);
    const trend = await t.invoke('dashboard:get-revenue-trend', { days: 7 });
    assert.strictEqual(trend[trend.length - 1].revenue, 400);
  });

  await check('R05-09', 'Sales History keeps the voided bill (flagged) but its totals count it as zero', async () => {
    const r = await t.invoke('sales:list', { dateFrom: today, dateTo: today });
    const row = r.rows.find((x) => x.id === A.saleId);
    assert.ok(row && row.is_voided === 1);
    assert.strictEqual(r.totals.sumTotal, 400);
    assert.strictEqual(r.totals.voidedCount, 1);
    const det = await t.invoke('sales:get-detail', { id: A.saleId });
    assert.strictEqual(det.sale.is_voided, 1);
    assert.ok(det.sale.voided_by_name);
  });

  await check('R05-10', 'a voided bill cannot be edited, voided again, opened for edit or returned', async () => {
    const e = await t.invoke('sales:update', { saleId: A.saleId, saleType: 'retail', customerId: ahmed, items: [t.line(book, 1, 500)], discountAmount: 0, paidAmount: 0, paymentMethod: 'cash' }, 'admin');
    const v = await t.invoke('sales:void', { saleId: A.saleId }, 'admin');
    const g = await t.invoke('sales:get-for-edit', { saleId: A.saleId }, 'admin');
    const r1 = await t.invoke('returns:get-returnable', { saleId: A.saleId });
    const item = d.prepare('SELECT id FROM sale_items WHERE sale_id = ?').get(A.saleId);
    const r2 = await t.invoke('returns:create', { saleId: A.saleId, reason: 'faulty', lines: [{ saleItemId: item.id, quantity: 1 }] });
    for (const r of [e, v, g, r1, r2]) assert.strictEqual(r.success, false);
    assert.strictEqual(t.stockOf(book.variantId), 20);
  });

  await check('R05-11', 'invoice numbers are never reused after a void', async () => {
    const n = await mk([t.line(pen, 1, 100)], { paidAmount: 100 });
    const nos = d.prepare('SELECT invoice_no FROM sales').all().map((r) => r.invoice_no);
    assert.strictEqual(new Set(nos).size, nos.length);
    assert.ok(n.invoiceNo.endsWith('-0004'), n.invoiceNo);
  });

  await check('R05-12', 'reprint data says VOIDED and prints no outstanding balance', async () => {
    const r = await t.invoke('sales:get-receipt-data', { saleId: A.saleId, showDues: true });
    assert.ok(r.stampLines[0].includes('VOIDED'));
    assert.strictEqual(r.showDues, false);
  });

  await check('R05-13', 'payments list, delete, statements, overview, aging, global search skip it', async () => {
    const hist = await t.invoke('ledgers:get-payment-history', {});
    assert.ok(!hist.some((p) => p.sale_id === A.saleId));
    const pay = d.prepare('SELECT id FROM payments WHERE sale_id = ?').get(A.saleId);
    assert.strictEqual((await t.invoke('payments:delete', { paymentId: pay.id })).success, false);
    const st = await t.invoke('reports:get-customer-statements', { filters: {} });
    assert.strictEqual(st.rows.find((r) => r.id === ahmed).balance_owed, 200);
    const ov = await t.invoke('ledgers:get-overview', {});
    assert.strictEqual(ov.totalReceivable, 200);
    const aging = await t.invoke('ledgers:get-aging-report', {});
    assert.ok(!aging.some((r) => r.customerId === ahmed));
    const g = await t.invoke('global:search', { query: 'Ahmed' });
    assert.strictEqual(g.customers[0].balance_owed, 200);
  });

  await check('R05-14', 'product stats and last-sold date ignore the voided bill', async () => {
    const st = await t.invoke('stock:get-product-stats', { productId: book.productId });
    assert.strictEqual(st.salesCount, 0);
    assert.strictEqual(st.revenue, 0);
    assert.strictEqual(d.prepare('SELECT last_sold_at FROM product_variants WHERE id = ?').get(book.variantId).last_sold_at, null);
  });

  await check('R05-15', 'sync: the void travels as updates (sales + payment), never as a delete', () => {
    const rows = d.prepare('SELECT table_name, operation FROM sync_outbox WHERE id > ?').all(outboxBefore);
    assert.ok(rows.some((r) => r.table_name === 'sales' && r.operation === 'update'));
    assert.ok(rows.some((r) => r.table_name === 'payments' && r.operation === 'update'));
    assert.ok(!rows.some((r) => r.operation === 'delete'));
    const cfg = t.m('sync/syncSchema').SYNC_TABLES.sales;
    assert.ok(cfg.fks.voided_by && cfg.fks.voided_by.nullable);
  });

  await check('R05-16', 'credit check ignores a voided bill', async () => {
    const r = await t.invoke('customers:credit-check', { customerId: ahmed, addAmount: 0, excludeSaleId: A.saleId }, 'cashier');
    assert.strictEqual(r.balanceBefore, 200);
  });

  await check('R05-17', 'sync round trip: a voided sale encoded and applied on another DB stays voided', () => {
    const { encodeRow } = t.m('sync/recordCodec');
    const row = d.prepare('SELECT * FROM sales WHERE id = ?').get(A.saleId);
    const wire = encodeRow(d, 'sales', row);
    assert.strictEqual(wire.is_voided, 1);
    assert.ok(wire.voided_by__uuid);
  });
};
