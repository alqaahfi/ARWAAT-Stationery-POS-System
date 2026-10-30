// Stage 1 UI flows & counter anomalies tested in the real Admin and Cashier windows.
const path = require('path');
const H = require('./lib/h');
const D = require('./lib/data');
const POS = require('./lib/pos');
const S = require('./lib/shop');
const { check, expectEq, q, execSql } = H;

const MASTER_FILE = path.join(H.ROOT, 'test-backups', 'CLEAN-MASTER.db');

async function resetPosToIdle(C) {
  await POS.closeDialogs(C);
  for (let i = 0; i < 8; i++) {
    if (await C.hasText('Ready for the next customer', 200) || await C.hasText('Start a new sale', 200)) return;
    if (await C.hasText('Cancel this sale', 200) || await C.hasText('Cancel sale?', 200)) {
      await C.press('Enter');
      await H.sleep(200);
      continue;
    }
    await C.press('Escape');
    await H.sleep(200);
  }
}

(async () => {
  const rec = H.startRecording('07-stage1-ui');
  let A = await H.openApp('admin');
  await S.loginIf(A, 'admin', 'Admin@123');

  await check('STAGE1-UI', 'UI-R00', 'Restore CLEAN-MASTER before Stage 1 UI checks', 'V', async () => {
    A = await D.restoreBackup(A, MASTER_FILE);
    await S.loginIf(A, 'admin', 'Admin@123');
  }, A);

  const C = await H.openApp('cashier');
  await S.loginIf(C, 'cashier1', 'Cash@123');
  const ap = A.page;
  const cp = C.page;

  // --- Rule 9 & Rule 11: Quick-add missing item at POS + Cash-only payment step ---
  await check('STAGE1-UI', 'UI-R11-01', 'Cashier quick-adds a missing item (F7) at the counter (warns on similar names) and sells it for cash (Rule 9 & Rule 11)', 'V', async () => {
    await resetPosToIdle(C);
    await POS.startSale(C, null);
    await C.press('F7');
    await C.see('Add a missing item', 5000);

    const dlg = cp.getByRole('dialog');
    await C.type(dlg.getByPlaceholder('e.g. Blue gel pen'), 'Dollar Pointer', 'similar name');
    await C.see('Similar items are already in the shop', 5000);

    await C.type(dlg.getByPlaceholder('Scan or type, or leave empty'), '9901', 'barcode 9901');
    await C.type(dlg.getByPlaceholder('e.g. Blue gel pen'), 'Neon Highlighter Set', 'name');
    await C.type(dlg.getByPlaceholder('0'), '250', 'selling price 250');
    await C.click(dlg.getByRole('button', { name: 'Add to bill' }), 'Add to bill');

    // QuickAddItemDialog adds 1 to the bill and returns to the item search stage
    await C.see('Neon Highlighter Set', 5000);
    await C.see('Add items', 5000);

    // Go to payment step and verify Rule 9: Amount received + Change, no Bank/Card buttons
    await C.press('Tab');
    await C.see('Any discount?', 5000);
    await C.press('Enter');
    if (await C.hasText('How would you like to print the receipt?', 500)) await C.press('Enter');
    await C.see('Amount received', 5000);
    const nonCash = await cp.getByRole('button', { name: /^(Bank|Card|Cheque)$/i }).count();
    if (nonCash > 0) throw new Error('Found non-cash payment button on POS payment step');

    await C.press('Enter');
    await POS.finishSale(C);

    const prod = q("SELECT id, needs_review FROM products WHERE name = 'Neon Highlighter Set'")[0];
    const stock = q('SELECT stock_qty FROM product_variants WHERE product_id = ?', [prod.id])[0].stock_qty;
    expectEq(prod.needs_review, 1, 'needs_review');
    expectEq(stock, -1, 'stock after selling quick-added item');
  }, C);

  // --- Rule 11: Admin Home Needs attention, P&L & Stock report buying price missing, Products Needs review Approve & Merge ---
  await check('STAGE1-UI', 'UI-R11-02', 'Admin sees quick-added item on Home Needs attention, P&L & Stock Report flag buying price missing, and Admin edits & approves or merges it', 'V', async () => {
    await D.goSection(A, 'Home');
    await ap.evaluate(() => window.dispatchEvent(new Event('pos:sale-completed')));
    await A.see('1 item needs review', 8000);

    // Profit & Loss flags buying price missing
    await D.goSection(A, 'Reports');
    await A.click(ap.getByText('Profit & Loss', { exact: false }).first(), 'report Profit & Loss');
    await A.see('Buying price missing', 8000);

    // Stock Report flags buying price missing
    await D.goSection(A, 'Reports');
    await A.click(ap.getByText('Stock', { exact: false }).first(), 'report Stock');
    await A.see('Buying price missing', 8000);

    // Products -> Needs review tab shows count badge (1) and disabled Approve button until buying price is set
    await D.goSection(A, 'Products');
    await A.see('Needs review (1)', 8000);
    await A.click(ap.getByRole('radio', { name: /Needs review/i }), 'tab Needs review');
    await A.see('Neon Highlighter Set', 5000);
    await A.see('Missing', 5000);

    const approveBtn = ap.getByRole('button', { name: 'Approve' }).first();
    if (!(await approveBtn.isDisabled())) throw new Error('Approve button was enabled before setting buying price');

    await A.click(ap.getByRole('button', { name: 'Edit' }).first(), 'Edit Neon Highlighter Set');
    await A.type(ap.getByLabel('Buying Price').first(), '150', 'Buying Price 150');
    await A.type(ap.getByLabel('Wholesale Price').first(), '220', 'Wholesale Price 220');
    await A.click(A.btn(/Save (Changes|product)/i), 'Save');
    await H.sleep(400);

    await D.goSection(A, 'Products');
    await A.click(ap.getByRole('radio', { name: /Needs review/i }), 'tab Needs review');
    await A.click(ap.getByRole('button', { name: 'Approve' }).first(), 'Approve');
    await A.see('Nothing to review', 5000);

    // Quick-add a duplicate item and Merge it into Dollar Pointer Pen Blue (1001)
    await ap.evaluate(async () => {
      await window.api.products.quickAdd({ name: 'Dup Pointer Pen', retailPrice: 30 });
      window.dispatchEvent(new Event('pos:stock-changed'));
    });
    await A.see('Dup Pointer Pen', 5000);

    await A.click(ap.getByRole('button', { name: 'Merge' }).first(), 'Merge');
    const mergeDlg = ap.getByRole('dialog');
    await A.type(mergeDlg.locator('input').first(), '1001', 'search 1001');
    await A.press('Enter');
    await A.see('Dollar Pointer Pen Blue', 5000);
    await A.click(mergeDlg.getByRole('button', { name: 'Merge' }), 'Merge into Dollar Pointer Pen Blue');

    const confirmDlg = ap.locator('[role="alertdialog"]');
    await confirmDlg.waitFor({ state: 'visible', timeout: 5000 });
    await A.click(confirmDlg.getByRole('button', { name: 'Merge' }), 'Confirm Merge');
    await A.see('Nothing to review', 5000);

    const reviewLeft = q('SELECT COUNT(*) AS n FROM products WHERE needs_review = 1 AND is_active = 1')[0].n;
    expectEq(reviewLeft, 0, 'items needing review after approve + merge');
  }, A);

  // --- Rule 12 & Rule 13: Admin approval box on Cashier screen, Stock to recount, Approvals log ---
  await check('STAGE1-UI', 'UI-R12-01', 'Admin approval box on cashier screen approves discount >10%, overselling stock (adds to Stock to recount), and voiding bill >10m old; cashier stays signed in', 'V', async () => {
    await resetPosToIdle(C);
    // 1. Discount 20% (> 10% cap) on Casio fx-991 Calculator (1012)
    await POS.startSale(C, null);
    await POS.addByScan(C, '1012', 1);
    await POS.discountAndPay(C, { discount: { percent: 20 } });

    await C.see('Admin approval', 5000);
    await C.see('limit of 10%', 5000);
    const appDlg = cp.getByRole('dialog');

    // Wrong password rejected
    await C.type(appDlg.getByLabel('Admin username'), 'admin', 'admin username');
    await C.type(appDlg.getByLabel('Admin password'), 'WrongPass1!', 'wrong password');
    await C.click(appDlg.getByRole('button', { name: 'Approve' }), 'Approve with wrong password');
    await C.see('Wrong Admin username or password', 5000);

    // Right password approves and completes sale
    await C.type(appDlg.getByLabel('Admin password'), 'Admin@123', 'correct admin password');
    await C.click(appDlg.getByRole('button', { name: 'Approve' }), 'Approve');
    await POS.finishSale(C);

    // Cashier stays signed in as Cashier One (cashier1)
    await C.see('Cashier One', 5000);

    // 2. Overselling stock: Casio fx-991 Calculator now has 4 left; sell 6 -> Admin approval -> added to Stock to recount
    await POS.startSale(C, null);
    await POS.addByScan(C, '1012', 6);
    await POS.discountAndPay(C, {});
    await C.see('Selling more than is in stock', 5000);
    const stockDlg = cp.getByRole('dialog');
    await C.type(stockDlg.getByLabel('Admin username'), 'admin', 'admin username');
    await C.type(stockDlg.getByLabel('Admin password'), 'Admin@123', 'admin password');
    await C.click(stockDlg.getByRole('button', { name: 'Approve' }), 'Approve oversell');
    await POS.finishSale(C);

    // 3. Rule 13: Backdate the latest sale by 15 minutes and void from Cashier screen -> requires Admin approval
    const lastSale = q('SELECT id, invoice_no FROM sales ORDER BY id DESC LIMIT 1')[0];
    execSql("UPDATE sales SET created_at = datetime('now', '-15 minutes') WHERE id = ?", [lastSale.id]);

    await C.press('F2');
    await C.see("Today's bills", 5000);
    await C.see(lastSale.invoice_no, 5000);
    // The backdated bill sorts below today's newer bills: select its row first.
    await C.click(cp.locator('[role="option"]').filter({ hasText: lastSale.invoice_no }).first(), 'select the old bill');
    await C.click(cp.getByRole('button', { name: 'Void', exact: true }), 'Void');
    await C.click(cp.getByRole('button', { name: /^Void bill/ }), 'Void bill');

    await C.see('Admin approval', 5000);
    const oldDlg = cp.getByRole('dialog').last();
    await C.type(oldDlg.getByLabel('Admin username'), 'admin', 'admin username');
    await C.type(oldDlg.getByLabel('Admin password'), 'Admin@123', 'admin password');
    await C.click(oldDlg.getByRole('button', { name: 'Approve' }), 'Approve old bill void');
    await H.sleep(500);
    await POS.closeDialogs(C);

    const isVoided = q('SELECT is_voided FROM sales WHERE id = ?', [lastSale.id])[0].is_voided;
    expectEq(isVoided, 1, 'old bill voided after Admin approval');

    // 4. Admin sees Stock -> To recount and Cashiers -> Approvals log
    await D.goSection(A, 'Stock');
    await A.click(ap.getByRole('radio', { name: /To recount/i }), 'tab To recount');
    await A.see('Casio fx-991 Calculator', 5000);
    await A.click(ap.getByRole('button', { name: 'Counted' }).first(), 'Counted');
    await A.see('Nothing to recount', 5000);

    await D.goSection(A, 'Cashiers');
    await A.click(ap.getByRole('radio', { name: /Approvals/i }), 'tab Approvals');
    await A.see('Cashier One', 5000);
    await A.see('Admin', 5000);
  }, A);

  // --- Rule 5 & Rule 14: Voided badge in Sales History + Reprint DUPLICATE COPY ---
  await check('STAGE1-UI', 'UI-R05-14', 'Voided bill shows red Voided badge and VOIDED stamp on print preview; active bill reprint shows DUPLICATE COPY', 'V', async () => {
    await D.goSection(A, 'Sale');
    await A.see('Voided', 5000);

    // Click Voided row -> SaleDetailSheet shows counts as zero & print preview shows *** VOIDED ***
    const voidedSale = q('SELECT id, invoice_no FROM sales WHERE is_voided = 1 ORDER BY id DESC LIMIT 1')[0];
    await A.click(ap.getByText(voidedSale.invoice_no).first(), 'open voided bill');
    await A.see('counts as zero', 5000);
    await A.click(ap.getByRole('dialog').getByRole('button', { name: /Print receipt/i }), 'Print receipt on voided bill');
    await A.see('*** VOIDED ***', 8000);
    await POS.closeDialogs(A);

    // Active bill: record original print in sale_prints and open print preview -> shows DUPLICATE COPY
    const activeSale = q('SELECT id, invoice_no FROM sales WHERE is_voided = 0 ORDER BY id DESC LIMIT 1')[0];
    execSql("INSERT INTO sale_prints (sale_id, copy, print_type, printed_by) VALUES (?, 'original', 'retail-thermal', 1)", [activeSale.id]);

    await A.click(ap.getByText(activeSale.invoice_no).first(), 'open active bill');
    await A.click(ap.getByRole('dialog').getByRole('button', { name: /Print receipt/i }), 'Print receipt on already-printed bill');
    await A.see('DUPLICATE COPY', 8000);
    await POS.closeDialogs(A);
  }, A);

  // --- Rule 2: Credit limit warning on POS ---
  await check('STAGE1-UI', 'UI-R02-01', 'Credit limit warning shows numbers and allows saving after confirm (Rule 2)', 'V', async () => {
    execSql("UPDATE customers SET credit_limit = 5000 WHERE name = 'Ahmed Raza'");
    await resetPosToIdle(C);
    // Ahmed Raza has credit_limit = 5000; sell 5 A4 Paper Rim (5 x 1350 = 6750 > 5000) on credit (pay 0)
    await POS.startSale(C, 'Ahmed Raza');
    await POS.addByScan(C, '1009', 5);
    await POS.discountAndPay(C, { pay: 0 });

    await C.see('Over the credit limit', 5000);
    await C.see('Over by:', 5000);
    await C.click(cp.locator('[role="alertdialog"]').getByRole('button', { name: 'Save anyway' }), 'Save anyway');
    await POS.finishSale(C);
  }, C);

  // --- Rule 15: Wrong computer clock warning banner ---
  await check('STAGE1-UI', 'UI-R15-01', 'Wrong computer clock banner appears in both Admin and Cashier windows when a sale is ahead of system time', 'V', async () => {
    const latest = q('SELECT id, created_at FROM sales ORDER BY id DESC LIMIT 1')[0];
    execSql("UPDATE sales SET created_at = datetime('now', '+2 hours') WHERE id = ?", [latest.id]);

    await ap.evaluate(() => window.dispatchEvent(new Event('pos:sale-completed')));
    await cp.evaluate(() => window.dispatchEvent(new Event('pos:sale-completed')));

    await A.see("The computer's date/time looks wrong", 5000);
    await C.see("The computer's date/time looks wrong", 5000);

    execSql('UPDATE sales SET created_at = ? WHERE id = ?', [latest.created_at, latest.id]);
    await ap.evaluate(() => window.dispatchEvent(new Event('pos:sale-completed')));
    await cp.evaluate(() => window.dispatchEvent(new Event('pos:sale-completed')));
  }, A);

  // --- Rule 16: Automatic daily backup UI + Home USB reminder ---
  await check('STAGE1-UI', 'UI-R16-01', 'Settings -> Backup shows Automatic backup card and Back up now; Home shows weekly USB reminder', 'V', async () => {
    await D.goSection(A, 'Settings');
    await A.click(ap.getByText('Backup & Restore', { exact: true }).first(), 'tab Backup & Restore');
    await A.see('Automatic backup', 5000);
    await A.click(ap.getByRole('button', { name: 'Back up now' }), 'Back up now');
    await A.see('Backup saved', 5000);

    execSql("DELETE FROM settings WHERE key = 'usb_reminder_done_at'");
    await D.goSection(A, 'Home');
    await A.see('Copy a backup to a USB drive', 5000);
    await A.click(ap.getByRole('button', { name: 'Done' }), 'Done USB reminder');
  }, A);

  // --- Rule 17: Returns search by item/customer/date + No-bill return ---
  await check('STAGE1-UI', 'UI-R17-01', 'Returns step 1 finds bills by item name and records an Admin no-bill return in cash at lowest 30-day price', 'V', async () => {
    await D.goSection(A, 'Sale');
    await A.click(ap.getByText('Returns', { exact: true }).first(), 'tab Returns');
    await A.click(A.btn(/New Return|Record a return/i), 'New Return');

    // Search by item name ('Paper Rim')
    await ap.keyboard.type('Paper Rim', { delay: H.S.keyDelay });
    await A.see('Ahmed Raza', 5000);

    const stockBefore = q("SELECT pv.stock_qty s FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE p.name = 'Dollar Pointer Pen Blue'")[0].s;

    await A.click(ap.getByRole('button', { name: 'Return without the bill' }), 'Return without the bill');
    const dlg = ap.getByRole('dialog');
    await A.see('Return without the bill', 5000);
    await A.type(dlg.locator('input').first(), '1001', 'search 1001');
    await A.press('Enter');
    await A.see('Dollar Pointer Pen Blue', 5000);

    await A.type(dlg.getByLabel('How many'), '2', 'qty 2');
    await dlg.getByLabel('Why').selectOption('changed_mind');
    await A.see('Cash back:', 5000);
    await A.click(dlg.getByRole('button', { name: 'Record return' }), 'Record no-bill return');

    await A.see('Return recorded', 5000);
    await A.click(ap.getByRole('button', { name: 'Done' }), 'Done');

    const stockAfter = q("SELECT pv.stock_qty s FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE p.name = 'Dollar Pointer Pen Blue'")[0].s;
    expectEq(stockAfter, stockBefore + 2, 'Dollar Pointer Pen Blue stock after no-bill return of 2');
  }, A);

  // --- Rule 18: Counter Anomalies in UI (large qty confirm, price changed mid-bill, sign-out holds open cart) ---
  await check('STAGE1-UI', 'UI-R18-01', 'Counter anomalies: qty > 100 asks confirmation, price changed mid-bill prompts cashier, sign-out with open cart holds the bill', 'V', async () => {
    await resetPosToIdle(C);
    await POS.startSale(C, null);
    await cp.keyboard.type('Dollar Pointer', { delay: 5 });
    await cp.locator('[role="listbox"] [role="option"]').first().waitFor({ state: 'visible', timeout: 5000 });
    await C.press('Enter');
    await C.see('How many?', 5000);
    await C.press('Control+A');
    await cp.keyboard.type('150');
    await C.press('Enter');

    await C.see('Large quantity or amount', 5000);
    await C.click(cp.locator('[role="alertdialog"]').getByRole('button', { name: 'Go back' }), 'Go back on large qty');

    await C.type(cp.locator('input[inputmode="numeric"]').first(), '2', 'qty 2');
    await C.press('Enter');
    await C.see('Add items', 5000);

    // Price changed by Admin while bill is open in Cashier cart
    const u1001 = q("SELECT pu.id AS unitId FROM product_units pu JOIN products p ON p.id = pu.product_id WHERE p.name = 'Dollar Pointer Pen Blue' AND pu.conversion_factor = 1")[0];
    execSql('UPDATE product_units SET retail_price = 35 WHERE id = ?', [u1001.unitId]);

    await POS.discountAndPay(C, {});
    await C.see('Price changed while this bill was open', 5000);
    await C.click(cp.locator('[role="alertdialog"]').getByRole('button', { name: 'Use new prices' }), 'Use new prices');

    execSql('UPDATE product_units SET retail_price = 30 WHERE id = ?', [u1001.unitId]);
    await resetPosToIdle(C);

    // Sign-out with open cart holds the bill instead of losing it
    const heldBefore = Number(((await C.body()).match(/Held \((\d+)\)/) || [])[1] || 0);
    await POS.startSale(C, null);
    await POS.addByScan(C, '1003', 1);
    await C.click(cp.getByRole('button', { name: 'Sign out' }), 'Sign out with open cart');
    await S.loginIf(C, 'cashier1', 'Cash@123');
    await C.see(`Held (${heldBefore + 1})`, 5000);
  }, C);

  await check('STAGE1-UI', 'UI-R99', 'Restore CLEAN-MASTER after Stage 1 UI suite', 'V', async () => {
    A = await D.restoreBackup(A, MASTER_FILE);
    await S.loginIf(A, 'admin', 'Admin@123');
  }, A);

  await rec.stop();
  process.exit(0);
})().catch(async (e) => { console.error(e); process.exit(1); });
