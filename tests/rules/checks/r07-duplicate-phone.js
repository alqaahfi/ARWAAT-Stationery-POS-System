// Rule 7: a duplicate customer phone/mobile is a warning; saving is allowed.
const assert = require('assert');

module.exports = async (t, check) => {
  const ahmed = t.addCustomer({ name: 'Ahmed Raza', phone: '0300-1234567' });
  t.addCustomer({ name: 'Bilal', mobile: '0321 7654321' });

  await check('R07-01', 'the same number in another format is found (digits compared, +92 = 0)', async () => {
    const r = await t.invoke('customers:check-duplicate-phone', { phone: '+92 300 1234567' });
    assert.deepStrictEqual(r.matches.map((m) => m.name), ['Ahmed Raza']);
    const m = await t.invoke('customers:check-duplicate-phone', { mobile: '03217654321' });
    assert.deepStrictEqual(m.matches.map((x) => x.name), ['Bilal']);
  });
  await check('R07-02', 'editing a customer does not match their own number; a new number matches nothing', async () => {
    assert.strictEqual((await t.invoke('customers:check-duplicate-phone', { phone: '03001234567', excludeId: ahmed })).matches.length, 0);
    assert.strictEqual((await t.invoke('customers:check-duplicate-phone', { phone: '0333 0000000' })).matches.length, 0);
  });
  await check('R07-03', 'saving a customer with a duplicate number is still allowed', async () => {
    const r = await t.invoke('customers:create', { name: 'Ahmed Brother', customerType: 'retail', phone: '0300-1234567' });
    assert.ok(r.success, r.reason);
  });
  await check('R07-04', 'the check is Admin-only (customer records)', async () => {
    const r = await t.invoke('customers:check-duplicate-phone', { phone: '03001234567' }, 'cashier');
    assert.strictEqual(r.success, false);
  });
};
