// Rule 2: credit limit is a warning only — never blocks.
const assert = require('assert');

module.exports = async (t, check) => {
  const pen = t.addProduct({ name: 'Pen', retail: 1000, stock: 100 });
  const ahmed = t.addCustomer({ name: 'Ahmed', opening: 9000, creditLimit: 10000 });
  const noLimit = t.addCustomer({ name: 'Bilal', opening: 9000, creditLimit: 0 });

  await check('R02-01', 'credit check gives the numbers when a bill would pass the limit', async () => {
    const r = await t.invoke('customers:credit-check', { customerId: ahmed, addAmount: 3500 }, 'cashier');
    assert.ok(r.success && r.overLimit);
    assert.strictEqual(r.balanceAfter, 12500);
    assert.strictEqual(r.limit, 10000);
    assert.ok(/Ahmed at Rs\. 12,500, over their credit limit of Rs\. 10,000/.test(r.message), r.message);
  });

  await check('R02-02', 'within the limit / blank limit / fully paid: no warning', async () => {
    assert.strictEqual((await t.invoke('customers:credit-check', { customerId: ahmed, addAmount: 500 }, 'cashier')).overLimit, false);
    assert.strictEqual((await t.invoke('customers:credit-check', { customerId: noLimit, addAmount: 50000 }, 'cashier')).overLimit, false);
    assert.strictEqual((await t.invoke('customers:credit-check', { customerId: ahmed, addAmount: 0 }, 'cashier')).overLimit, false);
  });

  await check('R02-03', 'a credit sale over the limit is still saved (never blocked)', async () => {
    const r = await t.invoke('sales:create', { saleType: 'retail', customerId: ahmed, items: [t.line(pen, 5, 1000)], discountAmount: 0, paidAmount: 0, paymentMethod: 'cash' }, 'cashier');
    assert.ok(r.success, r.reason);
    const bal = t.m('ledger/balanceEngine').getCustomerBalance(t.db(), ahmed);
    assert.strictEqual(bal, 14000);
  });

  await check('R02-04', 'editing a bill does not count the bill twice', async () => {
    const s = t.db().prepare('SELECT id FROM sales WHERE customer_id = ?').get(ahmed);
    const r = await t.invoke('customers:credit-check', { customerId: ahmed, addAmount: 1000, excludeSaleId: s.id }, 'cashier');
    assert.strictEqual(r.balanceAfter, 10000);
    assert.strictEqual(r.overLimit, false);
  });
};
