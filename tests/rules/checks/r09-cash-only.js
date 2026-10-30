// Rule 9: cash only — every new payment is recorded as 'cash'; old rows keep their method.
const assert = require('assert');

module.exports = async (t, check) => {
  const pen = t.addProduct({ name: 'Pen', retail: 100, cost: 60, stock: 20 });
  const ahmed = t.addCustomer({ name: 'Ahmed' });
  const sup = t.addSupplier({ name: 'Lahore Stationers' });
  const d = t.db();
  const method = (id) => d.prepare('SELECT payment_method FROM payments WHERE id = ?').get(id).payment_method;

  await check('R09-01', 'sale payment sent as "bank" is recorded as cash', async () => {
    const s = await t.invoke('sales:create', { saleType: 'retail', customerId: ahmed, items: [t.line(pen, 1, 100)], discountAmount: 0, paidAmount: 100, paymentMethod: 'bank' }, 'cashier');
    assert.ok(s.success, s.reason);
    assert.strictEqual(d.prepare('SELECT payment_method FROM payments WHERE sale_id = ?').get(s.saleId).payment_method, 'cash');
  });
  await check('R09-02', 'Receive Payment sent as "other" (or nothing) is recorded as cash', async () => {
    const a = await t.invoke('payments:create-standalone', { customerId: ahmed, amount: 50, paymentMethod: 'other' }, 'cashier');
    const b = await t.invoke('payments:create-standalone', { customerId: ahmed, amount: 25 }, 'cashier');
    assert.ok(a.success && b.success);
    assert.strictEqual(method(a.paymentId), 'cash');
    assert.strictEqual(method(b.paymentId), 'cash');
  });
  await check('R09-03', 'Pay Supplier and money paid with a purchase are recorded as cash', async () => {
    const p = await t.invoke('payments:create-supplier-payment', { supplierId: sup, amount: 500, paymentMethod: 'bank' });
    assert.ok(p.success, p.reason);
    assert.strictEqual(method(p.paymentId), 'cash');
    const pu = await t.invoke('purchases:create', { supplierId: sup, items: [{ productVariantId: pen.variantId, productUnitId: pen.unitId, quantity: 2, unitCost: 60 }], discountAmount: 0, paidAmount: 120, paymentMethod: 'bank' });
    assert.ok(pu.success, pu.reason);
    const row = d.prepare("SELECT payment_method FROM payments WHERE party_type = 'supplier' AND note LIKE 'Paid with purchase%'").get();
    assert.strictEqual(row.payment_method, 'cash');
  });
  await check('R09-04', 'old records keep their method and still show it', async () => {
    d.prepare("INSERT INTO payments (party_type, party_id, amount, payment_method) VALUES ('customer', ?, 10, 'bank')").run(ahmed);
    const hist = await t.invoke('ledgers:get-payment-history', { method: 'bank' });
    assert.strictEqual(hist.length, 1);
    const l = await t.invoke('customers:get-ledger', { id: ahmed });
    assert.ok(l.transactions.some((x) => x.type === 'payment' && x.reference === 'bank'));
  });
  await check('R09-05', 'credit (udhaar) for a named customer still works', async () => {
    const s = await t.invoke('sales:create', { saleType: 'retail', customerId: ahmed, items: [t.line(pen, 2, 100)], discountAmount: 0, paidAmount: 0, paymentMethod: 'cash' }, 'cashier');
    assert.ok(s.success, s.reason);
    assert.strictEqual(d.prepare('SELECT payment_status FROM sales WHERE id = ?').get(s.saleId).payment_status, 'unpaid');
  });
};
