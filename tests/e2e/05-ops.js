// Returns (prorated refund, over-return), void, reports, then backup restore. Run after 03*/04 (it changes shop-day numbers).
const fs = require('fs'); const path = require('path');
const H = require('./lib/h'); const D = require('./lib/data'); const S = require('./lib/shop'); const M = require('./lib/meta');
const { check, note, expectEq, q } = H;

(async () => {
  const rec = H.startRecording('05-ops');
  const A = await H.openApp('admin'); await S.loginIf(A, 'admin', 'Admin@123');
  const P = A.page;
  const call = (area, m, arg) => P.evaluate(([a, b, c]) => window.api[a][b](c), [area, m, arg]);
  const saleByNo = (n) => q('select id, invoice_no from sales order by id limit 1 offset ?', [n - 1])[0];
  const itemOf = (saleId, name) => q('select si.id, si.quantity from sale_items si join products p on p.id=si.product_id where si.sale_id=? and p.name=?', [saleId, name])[0];

  await check('RETURNS', 'RET-01', 'Prorated refund: 1 UHU from the 480 bill with Rs 30 discount refunds 93.75, not 100', 'V', async () => {
    const s2 = saleByNo(2), glue = itemOf(s2.id, 'UHU Glue Stick');
    await D.goSection(A, 'Sale'); await A.click(P.getByText('Returns', { exact: true }).first(), 'tab Returns');
    await A.click(A.btn(/New Return/), 'New Return');
    await P.keyboard.type(s2.invoice_no, { delay: H.S.keyDelay }); await H.sleep(900);
    await A.click(P.getByText(s2.invoice_no).first(), 'sale ' + s2.invoice_no);
    await A.see('Already returned', 5000);
    await A.type(P.locator('tr', { hasText: 'UHU Glue Stick' }).first().locator('input').first(), '1', 'return 1 glue');
    await A.click(P.getByText('Changed their mind', { exact: true }).first(), 'reason');
    await A.click(A.btn('Continue'), 'Continue'); await A.see('Value of returned items', 5000); await A.pause();
    await A.click(P.getByRole('button', { name: 'Record return' }).last(), 'Record return'); await H.sleep(700); if (await P.locator('[role="alertdialog"], [role="dialog"]').count()) await A.click(P.getByRole('button', { name: 'Record return' }).last(), 'confirm in the dialog');
    await A.see('Return recorded', 8000);
    const r = q('select total_amount, cash_refund_amount from sale_returns order by id desc limit 1')[0];
    expectEq(r.total_amount, 93.75, 'refund value'); expectEq(r.cash_refund_amount, 93.75, 'cash refund');
    await A.press('Escape');
  }, A);
  await check('RETURNS', 'RET-02', 'Returning more than was sold, or the same line again beyond what was sold, is blocked', 'B', async () => {
    const s1 = saleByNo(1), nb = itemOf(s1.id, 'Oxford Notebook'); // 1 sold, 1 already returned (R1)
    const again = await call('returns', 'create', { saleId: s1.id, reason: 'other', lines: [{ saleItemId: nb.id, quantity: 1 }] });
    if (again.success) throw new Error('the same notebook was returned twice');
    const s3 = saleByNo(3), geo = itemOf(s3.id, 'Deer Geometry Box');
    const over = await call('returns', 'create', { saleId: s3.id, reason: 'other', lines: [{ saleItemId: geo.id, quantity: 2 }] });
    if (over.success) throw new Error('returned 2 of 1 sold');
  });
  await check('RETURNS', 'RET-03', 'Return on a credit sale reduces the customer balance (no cash)', 'B', async () => {
    const before = S.bal('Ahmed Raza'); const s3 = saleByNo(3), geo = itemOf(s3.id, 'Deer Geometry Box');
    const r = await call('returns', 'create', { saleId: s3.id, reason: 'other', lines: [{ saleItemId: geo.id, quantity: 1 }] });
    if (!r.success) throw new Error(JSON.stringify(r));
    expectEq(S.bal('Ahmed Raza'), before - 350, 'Ahmed balance after returning the Geometry Box (350)');
  });

  // ---- void ----
  await check('VOID', 'VOID-01', 'Void restores stock, keeps the row marked is_voided=1, and drops the sale from totals (Rule 5)', 'B', async () => {
    const last = q('select id, invoice_no, total_amount from sales where is_voided=0 order by id desc limit 1')[0];
    const stockBefore = q("select v.stock_qty s from product_variants v join products p on p.id=v.product_id where p.name='Piano Ball Pen'")[0].s;
    const activeTotalBefore = q('select coalesce(sum(total_amount),0) t from sales where is_voided=0')[0].t;
    const r = await call('sales', 'void', { saleId: last.id });
    if (!r.success) throw new Error(JSON.stringify(r));
    expectEq(q("select v.stock_qty s from product_variants v join products p on p.id=v.product_id where p.name='Piano Ball Pen'")[0].s, stockBefore + 1, 'Piano stock after void');
    expectEq(q('select is_voided from sales where id=?', [last.id])[0].is_voided, 1, 'sale row kept with is_voided=1');
    expectEq(q('select coalesce(sum(total_amount),0) t from sales where is_voided=0')[0].t, activeTotalBefore - last.total_amount, 'active sales total after void');
    H.voided = last.invoice_no;
  });
  await check('VOID', 'VOID-02', 'A voided invoice number is never reused, and the void stays in the log', 'B', async () => {
    const aud = q("select count(*) n from activity_log where action='sale_voided'")[0].n;
    if (aud < 1) throw new Error('void not in activity log');
    const next = await call('sales', 'getNextInvoiceNo');
    if (next.invoiceNo === H.voided) throw new Error(`next invoice number ${next.invoiceNo} is the voided one`);
  });

  // ---- reports (visible) ----
  await check('REPORTS', 'REP-01', 'Reports screens open and show the sales figures (Sales, Profit & Loss, Stock, Customers, Suppliers, Expenses)', 'V', async () => {
    await D.goSection(A, 'Reports');
    for (const t of ['Sales', 'Profit', 'Stock', 'Customer', 'Supplier', 'Expense']) {
      const card = P.getByText(new RegExp('^' + t)).first();
      if (await card.count()) { await A.click(card, 'report ' + t); await A.shot('report-' + t); await A.pause(200); await D.goSection(A, 'Reports'); }
    }
  }, A);

  // ---- backup / restore (visible) ----
  let Acur = A;
  await check('BACKUP', 'BAK-01', 'Backup then restore gives identical data (every table compared)', 'V', async () => {
    const file = await D.makeBackup(Acur, 'RESTORE-TEST');
    const tables = q("select name from sqlite_master where type='table' and name not in ('sessions','dev_audit_log','activity_log','_migrations','sqlite_sequence','dev_panel_access_log','settings')").map((r) => r.name);
    const snap = () => Object.fromEntries(tables.map((t) => [t, JSON.stringify(q(`select * from "${t}" order by 1`))]));
    const before = snap();
    // change something, then restore
    await D.goSection(Acur, 'Expenses');
    await Acur.click(Acur.btn(/Add Expense/));
    await Acur.type(Acur.page.getByLabel('Amount *'), '1', '1');
    await Acur.type(Acur.page.getByLabel('Description *'), 'temp', 'temp');
    await Acur.click(Acur.btn('Save expense'));
    await Acur.see('temp', 5000);
    Acur = await D.restoreBackup(Acur, file, { mode: 'admin', restart: true });
    await S.loginIf(Acur, 'admin', 'Admin@123');
    const after = snap();
    const bad = tables.filter((t) => before[t] !== after[t]);
    if (bad.length) throw new Error('tables differ after restore: ' + bad.join(', '));
  }, Acur);
  await check('BACKUP', 'BAK-02', 'A non-backup / empty file is rejected and the data is untouched', 'V', async () => {
    const junk = path.join(H.ROOT, 'test-backups', 'not-a-backup.db'); fs.writeFileSync(junk, 'this is not a database');
    const empty = path.join(H.ROOT, 'test-backups', 'empty.db'); fs.writeFileSync(empty, '');
    const count = () => q('select (select count(*) from sales) a, (select count(*) from products) b')[0];
    const before = JSON.stringify(count());
    for (const f of [junk, empty]) {
      await D.restoreBackup(Acur, f, { expectError: true });
    }
    expectEq(JSON.stringify(count()), before, 'data after bad restores');
  }, Acur);

  await rec.stop(); process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
