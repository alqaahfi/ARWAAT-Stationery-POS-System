// Section 13: the full shop day. Cashier sales in the Cashier window, everything else in the Admin window.
const H = require('./lib/h'); const D = require('./lib/data'); const POS = require('./lib/pos'); const M = require('./lib/meta');
const { check, expectEq, q } = H;
const SEC = 'SHOP DAY';
let cashier, admin;
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !only || only.includes(k);

async function cashierLogin() { cashier = await H.openApp('cashier'); await require('./lib/shop').loginIf(cashier, 'cashier1', 'Cash@123'); }
async function adminLogin() { admin = await H.openApp('admin'); await require('./lib/shop').loginIf(admin, 'admin', 'Admin@123'); }
const { lastSale } = require('./lib/shop');

async function sale(id, name, spec) {
  await check(SEC, id, name, 'V', async () => {
    await cashier.banner(`${id}: ${name}`);
    await POS.startSale(cashier, spec.customer);
    for (const l of spec.lines) {
      if (l.scan) { for (let i = 0; i < (l.times || 1); i++) await cashier.scan(l.scan); await H.sleep(300); }
      else await POS.addByName(cashier, l.name, l.qty, { pack: l.pack });
    }
    await POS.discountAndPay(cashier, spec);
    const inv = await POS.finishSale(cashier);
    const s = lastSale();
    expectEq(s.total_amount, spec.total, 'bill total');
    if (spec.discount_amount !== undefined) expectEq(s.discount_amount, spec.discount_amount, 'discount');
    if (spec.paidDb !== undefined) expectEq(s.paid_amount, spec.paidDb, 'paid');
    if (spec.change && !(POS.finishSale.lastBody || '').includes(spec.change)) throw new Error('change ' + spec.change + ' not shown on the receipt sheet');
    console.log(`   saved ${inv}: total ${s.total_amount}, paid ${s.paid_amount}`);
  }, cashier);
}

(async () => {
  const rec = H.startRecording('03-shopday');
  await adminLogin();
  await cashierLogin();
  await cashier.page.reload(); await H.sleep(2500);

  if (want('sales')) {
    await sale('S1', 'S1 cash: 3 Dollar pens + 1 Notebook = 270, pays 500', { lines: [{ scan: '1001', times: 3 }, { scan: '1006' }], total: 270, pay: 500, paidDb: 270, change: '230' });
    await sale('S2', 'S2 cash: 1 Dollar Box + 2 UHU Glue = 480, Rs 30 bill discount, total 450', { lines: [{ name: 'Dollar', qty: 1, pack: 1 }, { scan: '1011', times: 2 }], discount: { amount: 30 }, total: 450, discount_amount: 30 });
    await sale('S3', 'S3 credit, Ahmed: Geometry Box + 5 Notebooks + 1 A4 Rim = 2,600, pays 1,000', { customer: 'Ahmed', lines: [{ scan: '1010' }, { scan: '1006', times: 5 }, { scan: '1009' }], total: 2600, pay: 1000, paidDb: 1000 });
    await sale('S4', 'S4 Sana: 1 Register Large = 200 from her advance (pays 0)', { customer: 'Sana', lines: [{ scan: '1008' }], total: 200, pay: 0, paidDb: 0 });
    await sale('S5', 'S5 cash: Casio with 10% discount = 3,420', { lines: [{ scan: '1012' }], discount: { percent: 10 }, total: 3420, discount_amount: 380 });
    await sale('S6', 'S6 cash: 1 Dux Box + 6 single pencils = 320', { lines: [{ name: 'Dux', qty: 1, pack: 1 }, { scan: '1004', times: 6 }], total: 320 });
  }
  await rec.stop();
  process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
