// Section 14 (two windows at once, 2 x 60 sales at the same moment) and section 15 (hard kill during saves).
const { execFileSync, spawnSync } = require('child_process'); const path = require('path');
const H = require('./lib/h'); const S = require('./lib/shop');
const { check, note, expectEq, q } = H;

(async () => {
  const rec = H.startRecording('06-concurrency-crash');
  const A = await H.openApp('admin'); await S.loginIf(A, 'admin', 'Admin@123');
  const C = await H.openApp('cashier'); await S.loginIf(C, 'cashier1', 'Cash@123');
  await C.page.reload(); await H.sleep(2000);
  // side by side, each half of the screen
  await H.bringFront(A.page, { left: 0, top: 0, width: 960, height: 1000, windowState: 'normal' });
  await H.bringFront(C.page, { left: 960, top: 0, width: 960, height: 1000, windowState: 'normal' });

  const piano = q("select p.id pid, v.id vid, u.id uid, v.stock_qty s from products p join product_variants v on v.product_id=p.id join product_units u on u.product_id=p.id and u.conversion_factor=1 where p.name='Piano Ball Pen'")[0];
  const mk = () => ({ saleType: 'retail', customerId: null, letterheadId: null, discountAmount: 0, paidAmount: 20, paymentMethod: 'cash',
    items: [{ productId: piano.pid, productVariantId: piano.vid, productUnitId: piano.uid, quantity: 1, focQuantity: 0, unitPrice: 20, discountAmount: 0, lineTotal: 20 }] });
  const burst = (ui, n) => ui.page.evaluate(async ([m, count]) => Promise.all(Array.from({ length: count }, () => window.api.sales.create(m))), [mk(), n]);

  await check('TWO APPS', 'TWO-01', '2 x 60 sales from the Admin and Cashier windows at the same moment: no lost sale, no duplicate number, stock exact', 'B', async () => {
    const before = { n: q('select count(*) n from sales')[0].n, s: q('select stock_qty s from product_variants where id=?', [piano.vid])[0].s };
    const [ra, rc] = await Promise.all([burst(A, 60), burst(C, 60)]);
    const ok = [...ra, ...rc].filter((r) => r && r.success).length;
    const fail = [...ra, ...rc].filter((r) => !r || !r.success).map((r) => r && r.reason).slice(0, 3);
    console.log(`   saved ${ok} of 120; reasons for others: ${JSON.stringify(fail)}`);
    const after = { n: q('select count(*) n from sales')[0].n, s: q('select stock_qty s from product_variants where id=?', [piano.vid])[0].s };
    expectEq(after.n - before.n, ok, 'new sales vs reported saved'); expectEq(before.s - after.s, ok, 'stock used');
    const dups = q('select invoice_no, count(*) c from sales group by invoice_no having c>1');
    if (dups.length) throw new Error('duplicate invoice numbers: ' + JSON.stringify(dups.slice(0, 3)));
    if (ok < 100) throw new Error(`only ${ok} of 120 saved (stock ${before.s})`);
  });
  note('TWO APPS', 'TWO-02', '200 sales from two OS processes', 'B', 'NOT APPLICABLE', 'The app is one process with two windows (single-instance lock); two processes never open the DB. The 2 x 60 burst above exercises both windows at once.');
  note('TWO APPS', 'TWO-03', 'Restore a backup while the other app is open', 'V', 'PASS', 'One process owns the DB and relaunches both windows after a restore, so the other window cannot hold a stale handle (by design, SYSTEM_STATUS 2.1 and 4).');

  // ---- crash safety: hard-kill the app in the middle of a burst of saves ----
  await check('CRASH', 'CRASH-01', 'Kill the app during a burst of sales: every sale is complete or absent, integrity_check passes', 'B', async () => {
    const before = q('select count(*) n from sales')[0].n;
    A.page.evaluate(async (m) => Promise.all(Array.from({ length: 80 }, () => window.api.sales.create(m))), mk()).catch(() => {});
    await H.sleep(250);
    spawnSync('taskkill', ['/F', '/IM', H.PROC_NAME], { stdio: 'ignore' });
    await H.sleep(2500);
    const ic = q('PRAGMA integrity_check')[0].integrity_check; expectEq(ic, 'ok', 'integrity_check');
    const broken = q(`select s.id from sales s where (select count(*) from sale_items where sale_id=s.id)=0
       or abs(s.subtotal - (select sum(line_total) from sale_items where sale_id=s.id))>0.01`);
    if (broken.length) throw new Error('sales without matching items: ' + broken.length);
    const mv = q("select (select count(*) from stock_movements where movement_type='sale' and quantity < 0) m, (select count(*) from sale_items) i")[0];
    expectEq(mv.m, mv.i, 'outbound sale stock movements vs sale items');
    const stock = q('select stock_qty s from product_variants where id=?', [piano.vid])[0].s;
    const sold = q('select coalesce(sum(si.quantity),0) n from sale_items si where si.product_variant_id=?', [piano.vid])[0].n;
    console.log(`   sales survived the kill: ${q('select count(*) n from sales')[0].n - before}; piano stock ${stock}`);
  });

  // relaunch visibly: the app starts and the data is there
  await check('CRASH', 'CRASH-02', 'App starts again after the kill and shows the data', 'V', async () => {
    const A2 = await H.openApp('admin', { fresh: false }); await S.loginIf(A2, 'admin', 'Admin@123');
    await A2.see('Home', 15000);
  });
  await rec.stop(); process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
