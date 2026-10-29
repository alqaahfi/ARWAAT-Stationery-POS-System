// Enter the whole test data set through the UI (cashier, 11 items, 3 customers, 2 suppliers).
const H = require('./lib/h');
const D = require('./lib/data');
const T = require('./lib/testdata');
const { check, expectEq } = H;

(async () => {
  const rec = H.startRecording('01-data-entry');
  const ui = await H.openApp('admin');

  await check('DATA', 'DAT-01', 'Create cashier1 / Cash@123 with sale, payment, products, history permissions and 10% discount cap', 'V', async () => {
    await D.addCashier(ui, { fullName: 'Cashier One', username: 'cashier1', password: 'Cash@123', perms: ['Make sales', 'See products and stock', 'Receive payments', 'See past sales'], discount: 10 });
    await H.sleep(1200);
    const r = H.q("select username, role, is_active from users where username='cashier1'");
    if (r.length !== 1 || r[0].role !== 'cashier') throw new Error('cashier1 not saved: ' + JSON.stringify(r));
  }, ui);

  for (const [i, pr] of T.PRODUCTS.entries()) {
    const id = 'DAT-P' + String(i + 1).padStart(2, '0');
    await check('DATA', id, `Add item ${pr.name} (stock ${pr.stock}, barcode ${pr.barcode})`, 'V', async () => {
      await D.addProduct(ui, pr);
      await ui.see('Product saved', 8000);
    }, ui);
  }
  // product 1 (Dollar) was typed already by the explorer run? No - table must contain exactly 11
  await check('DATA', 'DAT-P00', 'Opening stock value at cost = 72,420', 'B', async () => {
    const r = H.q('select sum(v.stock_qty * u.cost_price) as val, count(distinct p.id) as n from product_variants v join products p on p.id=v.product_id join product_units u on u.product_id=p.id and u.conversion_factor=1');
    expectEq(r[0].n, 11, 'item count');
    expectEq(r[0].val, 72420, 'opening stock value');
  });

  for (const [i, c] of T.CUSTOMERS.entries()) {
    await check('DATA', 'DAT-C' + (i + 1), `Add customer ${c.name}`, 'V', async () => { await D.addParty(ui, 'customer', c); await ui.see('saved', 8000); }, ui);
  }
  for (const [i, s] of T.SUPPLIERS.entries()) {
    await check('DATA', 'DAT-S' + (i + 1), `Add supplier ${s.name}`, 'V', async () => { await D.addParty(ui, 'supplier', s); await ui.see('saved', 8000); }, ui);
  }
  await rec.stop();
  console.log(JSON.stringify(H.q('select name, phone, opening_balance from customers')), JSON.stringify(H.q('select name, opening_balance from suppliers')));
  process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
