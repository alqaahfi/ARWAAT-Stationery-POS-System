// Shop day, admin side: return R1, payments P1/P2, expenses E1/E2, purchases PU1/PU2.
const H = require('./lib/h'); const D = require('./lib/data'); const S = require('./lib/shop');
const { check, expectEq, q } = H;
const SEC = 'SHOP DAY';

(async () => {
  const rec = H.startRecording('03b-shopday-admin');
  const A = await H.openApp('admin'); const P = A.page;
  await S.loginIf(A, 'admin', 'Admin@123');
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = (k) => !only || only.includes(k);

  if (want('R1')) await check(SEC, 'R1', 'R1: return 1 Notebook from S1, cash refund 180', 'V', async () => {
    await D.goSection(A, 'Sale');
    await A.click(P.getByText('Returns', { exact: true }).first(), 'tab Returns');
    await A.click(A.btn(/New Return/), 'New Return');
    const s1 = q('select invoice_no from sales order by id limit 1')[0].invoice_no;
    await P.keyboard.type(s1, { delay: H.S.keyDelay }); await H.sleep(900);
    await A.click(P.getByText(s1).first(), 'the sale ' + s1);
    await A.see('Already returned', 5000);
    const row = P.locator('tr', { hasText: 'Oxford Notebook' }).first();
    await A.type(row.locator('input').first(), '1', 'return quantity 1');
    await A.click(P.getByText('Changed their mind', { exact: true }).first(), 'reason');
    await A.click(A.btn('Continue'), 'Continue');
    await A.see('How to refund', 5000);
    await A.pause(); await A.shot('R1-refund-step');
    await A.click(P.getByRole('button', { name: 'Record return' }).last(), 'Record return'); await H.sleep(700); if (await P.locator('[role=dialog]').count()) await A.click(P.getByRole('button', { name: 'Record return' }).last(), 'confirm in the dialog');
    await A.see('Return recorded', 8000);
    const r = q('select total_amount, cash_refund_amount, restocked from sale_returns order by id desc limit 1')[0];
    expectEq(r.total_amount, 180, 'return value'); expectEq(r.cash_refund_amount, 180, 'cash refund');
    await A.press('Escape');
  }, A);

  const pay = async (id, name, who, amt) => { if (!want(id)) return; await check(SEC, id, name, 'V', async () => {
    await D.goSection(A, 'Customers');
    await A.click(P.getByText(who, { exact: false }).first(), 'customer ' + who);
    await A.click(A.btn('Payment'), 'Payment');
    await A.click(P.getByText(/^Advance payment/).first(), 'Advance payment (money received now)');
    await A.type(P.getByLabel('Amount').first(), String(amt), 'amount ' + amt);
    await A.click(P.getByRole('button', { name: /^(Save|Record|Receive|Add payment|Done)/ }).last(), 'save payment');
    await H.sleep(1200);
    expectEq(q("select amount from payments where party_type='customer' order by id desc limit 1")[0].amount, amt, 'payment saved');
    await A.press('Escape'); await A.press('Escape');
  }, A); };
  await pay('P1', 'P1: Ahmed pays 600', 'Ahmed Raza', 600);
  await pay('P2', 'P2: Bilal pays 500', 'Bilal Hussain', 500);

  const exp = async (id, name, amount, desc) => { if (!want(id)) return; await check(SEC, id, name, 'V', async () => {
    await D.goSection(A, 'Expenses');
    await A.click(A.btn(/Add Expense/), 'Add Expense');
    await A.type(P.getByLabel('Amount *'), String(amount), 'amount ' + amount);
    await A.type(P.getByLabel('Description *'), desc, desc);
    await A.click(A.btn('Save expense'), 'Save expense');
    await H.sleep(1000);
    expectEq(q('select amount from expenses order by id desc limit 1')[0].amount, amount, 'expense saved');
  }, A); };
  await exp('E1', 'E1: expense 2,500 (rent share)', 2500, 'Rent share');
  await exp('E2', 'E2: expense 150 (tea)', 150, 'Tea');

  const purchase = async (id, name, supplier, item, qty, packIdx, paid) => { if (!want(id)) return; await check(SEC, id, name, 'V', async () => {
    await D.goSection(A, 'Purchase');
    await A.click(A.btn(/New Purchase/), 'New Purchase');
    await A.type(P.getByPlaceholder('Search a supplier by name or phone'), supplier, 'supplier ' + supplier);
    await H.sleep(900); await A.press('Enter');
    await A.type(P.getByLabel('Search items').first(), item, 'item ' + item);
    await H.sleep(900); await A.press('Enter'); await H.sleep(500);
    if (packIdx) await P.getByLabel(/^Pack size for/).first().selectOption({ index: packIdx });
    await A.type(P.getByLabel(/^Quantity for/).first(), String(qty), 'qty ' + qty);
    await A.type(P.getByLabel('Amount paid'), String(paid), 'paid ' + paid);
    await A.pause(); await A.shot(id + '-form');
    await A.click(A.btn('Save purchase'), 'Save purchase'); await H.sleep(800);
    const c = P.getByRole('button', { name: /^(Yes|Save|Confirm|Continue)/ }).last();
    if (await c.count()) await A.click(c, 'confirm'); await H.sleep(1500);
    const pu = q('select total_amount, paid_amount from purchases order by id desc limit 1')[0];
    console.log('   purchase saved', JSON.stringify(pu));
    expectEq(pu.paid_amount, paid, 'paid');
    await A.press('Escape'); await A.press('Escape');
  }, A); };
  await purchase('PU1', 'PU1: Lahore Stationers, 10 Dollar Boxes at 200 = 2,000, pay 1,000', 'Lahore', 'Dollar', 10, 1, 1000);
  await purchase('PU2', 'PU2: Gujranwala Book Depot, 10 Urdu Textbooks at 300 = 3,000, paid in full', 'Gujranwala', 'Urdu', 10, 0, 3000);

  await rec.stop(); process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
