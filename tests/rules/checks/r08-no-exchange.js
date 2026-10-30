// Rule 8: no exchange screen — an exchange is a return plus a new sale.
const assert = require('assert');

module.exports = async (t, check) => {
  const pen = t.addProduct({ name: 'Pen', retail: 100, cost: 60, stock: 20 });
  const book = t.addProduct({ name: 'Book', retail: 250, cost: 150, stock: 20 });
  const ahmed = t.addCustomer({ name: 'Ahmed' });
  const be = t.m('ledger/balanceEngine');

  await check('R08-01', 'there is no exchange channel', () => {
    assert.ok(![...t.handlers.keys()].some((c) => /exchange/i.test(c)));
  });

  await check('R08-02', 'return 2 pens + new sale of 1 book: balance, stock and sales add up', async () => {
    const s = await t.invoke('sales:create', { saleType: 'retail', customerId: ahmed, items: [t.line(pen, 2, 100)], discountAmount: 0, paidAmount: 200, paymentMethod: 'cash' }, 'cashier');
    const item = t.db().prepare('SELECT id FROM sale_items WHERE sale_id = ?').get(s.saleId);
    const r = await t.invoke('returns:create', { saleId: s.saleId, reason: 'changed_mind', lines: [{ saleItemId: item.id, quantity: 2 }], cashRefund: 0 });
    assert.ok(r.success, r.reason);
    assert.strictEqual(be.getCustomerBalance(t.db(), ahmed), -200); // 200 credit on account
    const n = await t.invoke('sales:create', { saleType: 'retail', customerId: ahmed, items: [t.line(book, 1, 250)], discountAmount: 0, paidAmount: 50, paymentMethod: 'cash' }, 'cashier');
    assert.ok(n.success, n.reason);
    assert.strictEqual(be.getCustomerBalance(t.db(), ahmed), 0); // credit used + 50 paid = settled
    assert.strictEqual(t.stockOf(pen.variantId), 20);
    assert.strictEqual(t.stockOf(book.variantId), 19);
  });
};
