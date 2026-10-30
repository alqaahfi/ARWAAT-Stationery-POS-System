// Rule 15: wrong computer clock = warning (selling still allowed).
const assert = require('assert');

module.exports = async (t, check) => {
  const d = t.db();
  const { getClockStatus } = t.m('system/clockCheck');
  const pen = t.addProduct({ name: 'Pen', retail: 100, cost: 60, stock: 100 });

  await check('R15-01', 'a normal clock is fine (and the status channel is public, works signed out)', async () => {
    assert.strictEqual(getClockStatus(d).ok, true);
    const r = await t.invoke('app:get-clock-status', {}, 'nobody');
    assert.strictEqual(r.ok, true);
  });
  await check('R15-02', 'year before 2026 warns', () => {
    const r = getClockStatus(d, Date.UTC(2025, 5, 1));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.message, "The computer's date/time looks wrong - fix it before selling.");
  });
  await check('R15-03', 'earlier than the newest saved sale warns (5 minutes of slack)', async () => {
    const s = await t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [t.line(pen, 1, 100)], discountAmount: 0, paidAmount: 100, paymentMethod: 'cash' }, 'cashier');
    d.prepare("UPDATE sales SET created_at = '2027-03-01 10:00:00' WHERE id = ?").run(s.saleId);
    assert.strictEqual(getClockStatus(d, Date.UTC(2027, 2, 1, 9, 58)).ok, true);
    const r = getClockStatus(d, Date.UTC(2027, 1, 20));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'before_newest_sale');
  });
  await check('R15-04', 'more than 2 years past the newest record warns', () => {
    assert.strictEqual(getClockStatus(d, Date.UTC(2029, 1, 1)).ok, true);
    assert.strictEqual(getClockStatus(d, Date.UTC(2029, 6, 1)).reason, 'too_far_ahead');
  });
  await check('R15-05', 'selling is still allowed with a wrong clock (warning only)', async () => {
    const s = await t.invoke('sales:create', { saleType: 'retail', customerId: null, items: [t.line(pen, 1, 100)], discountAmount: 0, paidAmount: 100, paymentMethod: 'cash' }, 'cashier');
    assert.ok(s.success, s.reason);
    assert.strictEqual(getClockStatus(d).ok, false); // now is before the 2027 sale
  });
};
