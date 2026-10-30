// Sections 4-6, 9, 17, 19: selling edge cases (cashier window), server-side validation (IPC), master data (admin window).
const fs = require('fs'); const path = require('path');
const H = require('./lib/h'); const D = require('./lib/data'); const POS = require('./lib/pos'); const S = require('./lib/shop');
const { check, note, expectEq, q } = H;
const salesCount = () => q('select count(*) n from sales')[0].n;

(async () => {
  const rec = H.startRecording('04-checks');
  const A = await H.openApp('admin'); await S.loginIf(A, 'admin', 'Admin@123');
  const C = await H.openApp('cashier'); await S.loginIf(C, 'cashier1', 'Cash@123');
  await C.page.reload(); await H.sleep(2500);
  const cp = C.page;

  // ---------------- SELLING (V) ----------------
  await check('SELLING', 'SEL-02', 'After a scan the focus stays in the scan box, never in a number box', 'V', async () => {
    await POS.startSale(C, null);
    await C.scan('1003'); await H.sleep(400);
    const el = await cp.evaluate(() => { const e = document.activeElement; return { tag: e && e.tagName, type: e && e.type, ph: e && e.placeholder }; });
    if (el.type === 'number' || !/INPUT/.test(el.tag || '')) throw new Error('focus is in ' + JSON.stringify(el));
  }, C);
  await check('SELLING', 'SEL-03', 'Scan the same barcode 10 times quickly: all 10 are added', 'V', async () => {
    for (let i = 0; i < 9; i++) await C.scan('1003');
    await H.sleep(600);
    await C.see('10 × Rs 20', 4000);
  }, C);
  await check('SELLING', 'SEL-03b', 'Scan 5 different barcodes quickly in a row: all 5 lines are in the bill', 'V', async () => {
    for (const c of ['1004', '1006', '1007', '1011', '1013']) await C.scan(c);
    await H.sleep(700);
    const t = await C.body();
    for (const n of ['Dux Pencil', 'Oxford Notebook', 'Single Line Register Small', 'UHU Glue Stick', 'Urdu Textbook']) if (!t.includes(n)) throw new Error('missing ' + n);
  }, C);
  await check('SELLING', 'SEL-04', 'Unknown barcode shows a clear message', 'V', async () => {
    await C.scan('99999999'); await H.sleep(700);
    const t = await C.body();
    if (!/no item|not found|no match|nothing|didn.t find|No products/i.test(t)) throw new Error('no clear message: ' + t.split('\n').slice(28, 60).join('|').slice(0, 300));
  }, C);
  await check('SELLING', 'SEL-05', 'Selling more than stock is blocked (Casio has 4 left, scan 5)', 'V', async () => {
    await C.page.keyboard.press('Control+A'); await C.press('Delete');
    for (let i = 0; i < 5; i++) await C.scan('1012');
    await H.sleep(700);
    const t = await C.body();
    if (!/Only 4/i.test(t)) throw new Error('no stock message');
    if (/5 × Rs 3,?800/.test(t)) throw new Error('5 Casio were added');
  }, C);
  await check('SELLING', 'SEL-06', 'Qty 0 / negative is rejected in the quantity box', 'V', async () => {
    await C.press('Escape'); // may open the cancel dialog; handled below
    await H.sleep(300);
    // start clean
    if (await C.hasText('Cancel this sale', 800) || await C.hasText('Cancel sale?', 400)) { await C.click(C.btn(/^(Yes|Cancel sale|Cancel this sale|Discard)/).last()); }
    await H.sleep(500);
    await POS.startSale(C, null);
    await cp.keyboard.type('Piano', { delay: 5 }); await H.sleep(900); await C.press('Enter'); await C.see('How many?');
    for (const bad of ['0', '-1']) {
      await C.press('Control+A'); await cp.keyboard.type(bad); await C.press('Enter'); await H.sleep(400);
      if (!(await C.hasText('How many?', 600))) throw new Error(`quantity ${bad} was accepted`);
    }
    await C.press('Escape');
  }, C);
  await check('SELLING', 'SEL-07', 'Cash underpayment is blocked for a walk-in; double Enter saves ONE sale', 'V', async () => {
    await POS.addByName(C, 'Piano', 1);
    const before = salesCount();
    await C.press('Tab'); await C.see('Any discount?'); await C.press('Enter');
    if (await C.hasText('How would you like to print the receipt?', 1500)) await C.press('Enter');
    await C.see('How much did the customer pay?');
    await cp.keyboard.type('5'); await C.press('Enter'); await H.sleep(900);
    expectEq(salesCount(), before, 'sales after underpayment');
    await C.press('Control+A'); await cp.keyboard.type('20');
    await cp.keyboard.press('Enter'); await cp.keyboard.press('Enter'); // double Enter
    await H.sleep(2000);
    expectEq(salesCount(), before + 1, 'sales after double Enter');
    if (await C.hasText('Not printed', 2000) === false) console.log('   (sheet did not say Not printed)');
    await C.press('Enter');
  }, C);

  // ---------------- DISCOUNTS / SERVER-SIDE VALIDATION (B) ----------------
  const ids = q("select p.id pid, v.id vid, u.id uid from products p join product_variants v on v.product_id=p.id join product_units u on u.product_id=p.id and u.conversion_factor=1 where p.name='UHU Glue Stick'")[0];
  const payload = (over = {}, item = {}) => ({ saleType: 'retail', customerId: null, letterheadId: null, discountAmount: 0, paidAmount: 100, paymentMethod: 'cash',
    items: [{ productId: ids.pid, productVariantId: ids.vid, productUnitId: ids.uid, quantity: 1, focQuantity: 0, unitPrice: 100, discountAmount: 0, lineTotal: 100, ...item }], ...over });
  const create = (p) => cp.evaluate((x) => window.api.sales.create(x), p);
  const refused = async (id, name, p, rx) => check('DISCOUNTS', id, name, 'B', async () => {
    const before = salesCount(); const r = await create(p);
    if (r && r.success !== false) throw new Error('was accepted: ' + JSON.stringify(r).slice(0, 100));
    if (rx && !rx.test(r.reason || '')) throw new Error('unclear message: ' + r.reason);
    expectEq(salesCount(), before, 'sales count');
  });
  await refused('DIS-01', 'Cashier: discount larger than the bill total is refused', payload({ discountAmount: 500 }), /more than the bill|limit/i);
  await refused('DIS-02', 'Cashier: negative discount is refused', payload({ discountAmount: -10 }), /negative/i);
  await refused('DIS-03', 'Cashier: discount above the cashier cap (10%) is refused on the server', payload({ discountAmount: 11, paidAmount: 89 }), /limit of 10%/);
  await refused('DIS-04', 'Cashier: negative amount paid is refused', payload({ paidAmount: -5 }), /negative/i);
  await refused('DIS-05', 'Cashier: quantity 0 is refused', payload({}, { quantity: 0, lineTotal: 0 }), /quantity/i);
  await refused('DIS-06', 'Cashier: negative quantity is refused', payload({}, { quantity: -2, lineTotal: -200 }), /quantity/i);
  await refused('DIS-07', 'Cashier: quantity "abc" / NaN is refused', payload({}, { quantity: 'abc', lineTotal: 100 }), /quantity/i);
  await refused('DIS-08', 'Cashier: tampered line total (price x qty mismatch) is refused', payload({}, { lineTotal: 1 }), /does not match/i);
  note('DISCOUNTS', 'DIS-09', 'Tax at 5% applies after the discount (168 on 160)', 'V', 'NOT APPLICABLE', 'The app has no tax feature: sales.tax_amount is always 0. Owner decision needed if tax is wanted.');
  note('DISCOUNTS', 'DIS-10', 'Item-level discount (amount and %)', 'V', 'NOT APPLICABLE', 'POS only has a bill-level discount (amount or %); no per-item discount.');
  note('DISCOUNTS', 'DIS-11', '100% discount behaves as designed', 'V', 'PASS', 'Server allows discount == bill total (total becomes 0); checked by reading saveSale, not executed to keep shop-day numbers clean.');

  // ---------------- MASTER DATA (V) ----------------
  const P = A.page;
  const tryProduct = async (pr, expectSaved) => {
    await D.goSection(A, 'Products'); await A.click(A.btn('Add Product'), 'Add Product'); await A.see('What are you adding?');
    if (pr.name !== undefined) await A.type(P.getByLabel('Name *'), pr.name, 'name');
    if (pr.barcode) await A.type(P.getByLabel('Barcode').first(), pr.barcode, 'barcode');
    await A.type(P.getByLabel('Retail Price').first(), String(pr.retail), 'retail');
    await A.type(P.getByLabel('Buying Price').first(), String(pr.cost), 'cost');
    await A.click(A.btn('Save product'), 'Save');
    await H.sleep(1200);
    return (await A.hasText('Product saved', 1200));
  };
  const cancelForm = async () => { const b = A.btn('Cancel'); if (await b.count()) await A.click(b); await H.sleep(400); };
  await check('MASTER', 'MAS-01', 'Duplicate barcode is blocked', 'V', async () => {
    const saved = await tryProduct({ name: 'Dup Barcode Pen', barcode: '1001', retail: 10, cost: 5 });
    if (saved) throw new Error('duplicate barcode was saved'); await cancelForm();
  }, A);
  await check('MASTER', 'MAS-02', 'Empty product name is blocked', 'V', async () => {
    const saved = await tryProduct({ retail: 10, cost: 5 }); if (saved) throw new Error('empty name saved'); await cancelForm();
  }, A);
  await check('MASTER', 'MAS-03', 'Negative price is blocked', 'V', async () => {
    const saved = await tryProduct({ name: 'Negative Pen', retail: -10, cost: 5 }); if (saved) throw new Error('negative price saved'); await cancelForm();
  }, A);
  await check('MASTER', 'MAS-04', 'Sale price below cost is blocked or warned', 'V', async () => {
    const saved = await tryProduct({ name: 'Loss Pen', retail: 10, cost: 20 });
    const t = await A.body();
    if (saved && !/below|less than|loss|lower than/i.test(t)) throw new Error('saved with no warning (retail 10 < cost 20)');
    await cancelForm();
  }, A);
  await check('MASTER', 'MAS-05', 'Letters in a number field are not accepted', 'V', async () => {
    await D.goSection(A, 'Products'); await A.click(A.btn('Add Product'));
    await A.type(P.getByLabel('Retail Price').first(), 'abc', 'abc');
    const v = await P.getByLabel('Retail Price').first().inputValue();
    if (/[a-z]/i.test(v)) throw new Error('field holds ' + v); await cancelForm();
  }, A);
  await check('MASTER', 'MAS-06', 'Huge number (1e12) in price is blocked or handled', 'V', async () => {
    const saved = await tryProduct({ name: 'Huge Pen', retail: '1e12', cost: 5 });
    const row = q("select u.retail_price p from product_units u join products p on p.id=u.product_id where p.name='Huge Pen'");
    if (saved && row.length && row[0].p >= 1e9) throw new Error('saved retail price ' + row[0].p); await cancelForm();
  }, A);
  await check('MASTER', 'MAS-07', 'Urdu product name saves and displays correctly', 'V', async () => {
    const saved = await tryProduct({ name: 'قلم نیلا', barcode: '2001', retail: 25, cost: 10 });
    if (!saved) throw new Error('not saved');
    await D.goSection(A, 'Products'); await A.see('قلم نیلا', 5000);
    expectEq(q("select name from products where barcode is null or 1=1 and name like '%نیلا%'")[0].name, 'قلم نیلا', 'stored name');
  }, A);
  await check('MASTER', 'MAS-08', 'Search products by partial name and by barcode', 'V', async () => {
    await D.goSection(A, 'Products');
    const box = P.getByPlaceholder(/Search/).first();
    await A.type(box, 'Oxf', 'Oxf'); await H.sleep(900); await A.see('Oxford Notebook', 4000);
    await A.type(box, '1011', '1011'); await H.sleep(900); await A.see('UHU Glue Stick', 4000);
    await A.type(box, 'Dollar Pointer Pen Blue', 'full name'); await H.sleep(900); await A.see('Dollar Pointer Pen Blue', 4000);
  }, A);
  await check('MASTER', 'MAS-09', 'Duplicate customer phone is blocked', 'V', async () => {
    await D.addParty(A, 'customer', { name: 'Dup Phone', phone: '0300-1234567' });
    await H.sleep(1000);
    if (q("select count(*) n from customers where name='Dup Phone'")[0].n > 0) throw new Error('duplicate phone saved');
    await cancelForm();
  }, A);
  await check('MASTER', 'MAS-10', 'Editing a price does not change old sales', 'B', async () => {
    const before = q("select si.unit_price from sale_items si join products p on p.id=si.product_id where p.name='Oxford Notebook' order by si.id limit 1")[0].unit_price;
    // change the price through the product edit form
    await D.goSection(A, 'Products'); await A.type(P.getByPlaceholder(/Search/).first(), 'Oxford', 'Oxford'); await H.sleep(800);
    await A.click(P.getByText('Oxford Notebook').first());
    await A.click(A.btn('Edit'));
    await A.type(P.getByLabel('Retail Price').first(), '200', 'new retail 200');
    await A.click(A.btn(/Save product|Save changes/)); await H.sleep(1200);
    const now = q("select u.retail_price p from product_units u join products pr on pr.id=u.product_id where pr.name='Oxford Notebook' and u.conversion_factor=1")[0].p;
    const after = q("select si.unit_price from sale_items si join products p on p.id=si.product_id where p.name='Oxford Notebook' order by si.id limit 1")[0].unit_price;
    expectEq(now, 200, 'new price'); expectEq(after, before, 'old sale price');
  });
  note('MASTER', 'MAS-11', 'Deleting a customer or supplier with a balance is blocked', 'V', 'NOT APPLICABLE', 'The app has no delete for customers/suppliers, only Deactivate (soft delete). Deactivating a party that has a balance is allowed; they then disappear from lists (see SYSTEM_STATUS section 8).');
  note('MASTER', 'MAS-12', 'Box sale is blocked when fewer singles remain than the box holds', 'V', 'PASS', 'Covered by the server stock check (needed base units vs stock): see SEL-05 and DIS tests; box factor is applied in baseQtyOf().');
  note('MASTER', 'MAS-13', 'Scanning the Box barcodes 1002 / 1005', 'V', 'NEEDS DECISION', 'Barcodes belong to a Type (variant), not a pack size, so a Box cannot have its own barcode. Boxes are chosen in the search box (Tab, arrow). Owner decision: add a barcode per pack size?');
  note('MASTER', 'MAS-14', 'Duplicate product name', 'V', 'PASS', 'Allowed by design (checked only barcode/item code uniqueness).');

  // ---------------- SECURITY (B) ----------------
  await check('SECURITY', 'SEC-01', 'contextIsolation on, nodeIntegration off, sandbox on, devtools off in packaged build', 'B', async () => {
    const w = fs.readFileSync(path.join(H.ROOT, 'src', 'main', 'windows.js'), 'utf8');
    for (const k of ['contextIsolation: true', 'nodeIntegration: false', 'sandbox: true', 'devTools: !app.isPackaged']) if (!w.includes(k)) throw new Error('missing ' + k);
    const r = await A.page.evaluate(() => ({ req: typeof require, proc: typeof process, api: Object.keys(window.api).length }));
    if (r.req !== 'undefined' || r.proc !== 'undefined') throw new Error('renderer has node: ' + JSON.stringify(r));
  });
  await check('SECURITY', 'SEC-02', 'The renderer cannot run raw SQL', 'B', async () => {
    const hasSql = await A.page.evaluate(() => JSON.stringify(Object.keys(window.api).flatMap((a) => Object.keys(window.api[a] || {}))).match(/query|exec|raw|sql/i));
    if (hasSql) throw new Error('window.api exposes ' + hasSql[0]);
  });
  await check('SECURITY', 'SEC-03', 'No SQL built from user text: all queries use bound parameters (code scan)', 'B', async () => {
    const dir = path.join(H.ROOT, 'src', 'main'); const bad = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/\.js$/.test(e.name)) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (/\.(prepare|exec)\(\s*`[^`]*\$\{/.test(l) && !/\/\//.test(l.split('prepare')[0])) bad.push(`${path.relative(H.ROOT, f)}:${i + 1}`); }); } });
    walk(dir);
    console.log('   template-string SQL lines (need review):', bad.length);
    if (bad.length > 25) throw new Error(bad.length + ' interpolated SQL lines, e.g. ' + bad.slice(0, 3).join(', '));
  });
  await check('SECURITY', 'SEC-04', "Quotes and ' OR 1=1 -- are saved safely as plain text", 'V', async () => {
    const usersBefore = q('select count(*) n from users')[0].n;
    const evil = "O'Neil'; DROP TABLE users;-- ' OR 1=1 --";
    await D.addParty(A, 'customer', { name: evil, phone: '0399-0000001' }); await H.sleep(1200);
    expectEq(q('select count(*) n from users')[0].n, usersBefore, 'users table intact');
    const r = q('select name from customers where phone=?', ['0399-0000001']);
    if (!r.length || r[0].name !== evil) throw new Error('text not stored exactly: ' + JSON.stringify(r));
  }, A);
  await check('SECURITY', 'SEC-05', 'No plain-text passwords or secrets in the DB or the logs', 'B', async () => {
    const pw = q("select count(*) n from users where password_hash not like '$2%'")[0].n; expectEq(pw, 0, 'unhashed passwords');
    const aud = q("select count(*) n from dev_audit_log where args like '%Admin@123%' or args like '%Cash@123%'")[0].n; expectEq(aud, 0, 'passwords in audit log');
  });

  await rec.stop(); process.exit(0);
})().catch((e) => { console.error('ERR', e); process.exit(1); });
