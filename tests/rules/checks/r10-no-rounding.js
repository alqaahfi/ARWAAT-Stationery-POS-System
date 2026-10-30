// Rule 10: no rounding of totals (paisa kept exactly; never rounded to whole rupees).
const assert = require('assert');

module.exports = async (t, check) => {
  const glue = t.addProduct({ name: 'UHU', retail: 31.25, cost: 20, stock: 50 });
  const d = t.db();

  await check('R10-01', 'a bill of 3 x 31.25 - 0.5 discount is stored as exactly 93.25', async () => {
    const r = await t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [t.line(glue, 3, 31.25)], discountAmount: 0.5, paidAmount: 93.25, paymentMethod: 'cash' }, 'cashier');
    assert.ok(r.success, r.reason);
    const s = d.prepare('SELECT subtotal, total_amount, paid_amount, balance_due FROM sales WHERE id = ?').get(r.saleId);
    assert.deepStrictEqual(s, { subtotal: 93.75, total_amount: 93.25, paid_amount: 93.25, balance_due: 0 });
  });
  await check('R10-02', 'a walk-in paying 93 for a 93.25 bill is refused (not rounded away)', async () => {
    const r = await t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [t.line(glue, 3, 31.25)], discountAmount: 0.5, paidAmount: 93, paymentMethod: 'cash' }, 'cashier');
    assert.strictEqual(r.success, false);
  });
  await check('R10-03', 'Sales report and Home show the exact paisa total', async () => {
    const today = d.prepare("SELECT date('now','localtime') AS d").get().d;
    const rep = await t.invoke('reports:get-sales-report', { filters: { dateFrom: today, dateTo: today } });
    assert.strictEqual(rep.netRevenue, 93.25);
    const home = await t.invoke('dashboard:get-summary', {});
    assert.strictEqual(home.todaySalesTotal, 93.25);
  });
  await check('R10-04', 'screen money format keeps paisa (formatCurrency, same code as utils/format.js)', () => {
    const src = require('fs').readFileSync(require('path').join(t.ROOT, 'src/renderer/utils/format.js'), 'utf8');
    const body = src.slice(src.indexOf('export function formatCurrency('), src.indexOf('export function formatCurrencyCompact('));
    assert.ok(!/Math\.round\(value\)/.test(body), 'formatCurrency must not round to whole rupees');
    assert.ok(!/K`|M`/.test(body), 'formatCurrency must not compact to K/M');
  });
};
