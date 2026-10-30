// Stage 4: Screenshot every page, form, modal and print preview at 1366x768, 1920x1080, and 683x768 for both Admin and Cashier windows.
const fs = require('fs');
const path = require('path');
const H = require('./lib/h');
const D = require('./lib/data');
const POS = require('./lib/pos');
const S = require('./lib/shop');
const { check, q, execSql } = H;

const MASTER_FILE = path.join(H.ROOT, 'test-backups', 'CLEAN-MASTER.db');
const SCREENS_ROOT = path.join(H.ROOT, 'test-results', 'screens');
const SIZES = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '683x768', width: 683, height: 768 },
];

async function setWindowSize(ui, width, height) {
  await H.bringFront(ui.page, { windowState: 'normal', width, height });
  await ui.page.setViewportSize({ width, height });
  await H.sleep(100);
}

async function resetPosToIdle(C) {
  await POS.closeDialogs(C);
  for (let i = 0; i < 4; i++) {
    if (await C.hasText('Ready for the next customer', 300) || await C.hasText('Start a new sale', 300)) return;
    if (await C.hasText('Cancel this sale', 300) || await C.hasText('Cancel sale?', 300)) {
      await C.press('Enter');
      await H.sleep(200);
      continue;
    }
    await C.press('Escape');
    await H.sleep(200);
  }
}

async function auditAndShoot(ui, winName, sizeLabel, pageSlug, issues) {
  const dir = path.join(SCREENS_ROOT, winName, sizeLabel);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${pageSlug}.png`);
  await ui.page.screenshot({ path: file });

  const audit = await ui.page.evaluate(() => {
    const text = document.body.innerText || '';
    const badTokens = [];
    if (/\bundefined\b/.test(text)) badTokens.push('undefined');
    if (/\bNaN\b/.test(text)) badTokens.push('NaN');
    if (/\[object Object\]/.test(text)) badTokens.push('[object Object]');
    return { badTokens };
  });

  if (audit.badTokens.length > 0) {
    issues.push(`${winName}/${sizeLabel}/${pageSlug}: bad text tokens ${audit.badTokens.join(', ')}`);
  }
}

(async () => {
  const rec = H.startRecording('09-screenshots-ui');
  let A = await H.openApp('admin');
  await S.loginIf(A, 'admin', 'Admin@123');

  await check('STAGE4-UI', 'UI-S00', 'Restore CLEAN-MASTER and seed sample active & voided sales for Stage 4 visual & print preview audit', 'V', async () => {
    A = await D.restoreBackup(A, MASTER_FILE);
    await S.loginIf(A, 'admin', 'Admin@123');
  }, A);

  const C = await H.openApp('cashier');
  await S.loginIf(C, 'cashier1', 'Cash@123');
  const ap = A.page;

  // Create 2 sample sales on Cashier so Sales History & Print Previews have active + voided bills
  await resetPosToIdle(C);
  await POS.startSale(C, null);
  await POS.addByScan(C, '1001', 2);
  await POS.discountAndPay(C, {});
  await POS.finishSale(C);

  await POS.startSale(C, 'Ahmed Raza');
  await POS.addByScan(C, '1006', 1);
  await POS.discountAndPay(C, {});
  await POS.finishSale(C);

  const sales = q('SELECT id FROM sales ORDER BY id ASC');
  if (sales.length >= 2) {
    execSql("UPDATE sales SET is_voided = 1, voided_at = datetime('now'), voided_by = 1 WHERE id = ?", [sales[0].id]);
    execSql("INSERT INTO sale_prints (sale_id, copy, print_type, printed_by) VALUES (?, 'original', 'retail-thermal', 1)", [sales[1].id]);
  }

  for (const sz of SIZES) {
    await check('STAGE4-UI', `UI-ADMIN-${sz.label}`, `Admin window visual & layout audit at ${sz.label} across all sections, tabs, forms, modals & print previews`, 'V', async () => {
      const issues = [];
      await setWindowSize(A, sz.width, sz.height);

      // 1. Home
      await D.goSection(A, 'Home');
      await A.see('Needs attention', 5000);
      await auditAndShoot(A, 'admin', sz.label, 'home-overview', issues);

      // 2. POS on Admin
      await A.click(ap.getByRole('button', { name: 'New Sale' }).first(), 'New Sale');
      await H.sleep(200);
      await auditAndShoot(A, 'admin', sz.label, 'pos-idle', issues);

      // 3. Customers & Add Customer form
      await D.goSection(A, 'Customers');
      await A.see('Ahmed Raza', 5000);
      await auditAndShoot(A, 'admin', sz.label, 'customers-list', issues);
      await A.click(A.btn('Add Customer'), 'Add Customer');
      await A.see('Full Name', 5000);
      await auditAndShoot(A, 'admin', sz.label, 'customers-new-form', issues);

      // 4. Suppliers & Add Supplier form
      await D.goSection(A, 'Suppliers');
      await A.see('Lahore Stationers', 5000);
      await auditAndShoot(A, 'admin', sz.label, 'suppliers-list', issues);
      await A.click(A.btn('Add Supplier'), 'Add Supplier');
      await A.see('Full Name', 5000);
      await auditAndShoot(A, 'admin', sz.label, 'suppliers-new-form', issues);

      // 5. Products tabs & Add Product form
      await D.goSection(A, 'Products');
      await A.see('Dollar Pointer Pen Blue', 5000);
      await auditAndShoot(A, 'admin', sz.label, 'products-all', issues);

      await A.click(ap.getByRole('radio', { name: /Running Low/i }), 'tab Running Low');
      await auditAndShoot(A, 'admin', sz.label, 'products-low-stock', issues);

      await A.click(ap.getByRole('radio', { name: /Not Selling/i }), 'tab Not Selling');
      await auditAndShoot(A, 'admin', sz.label, 'products-dead-stock', issues);

      await A.click(ap.getByRole('radio', { name: /Categories/i }), 'tab Categories');
      await auditAndShoot(A, 'admin', sz.label, 'products-categories', issues);

      await A.click(ap.getByRole('radio', { name: /Needs review/i }), 'tab Needs review');
      await auditAndShoot(A, 'admin', sz.label, 'products-needs-review', issues);

      await A.click(ap.getByRole('radio', { name: /All Products/i }), 'tab All Products');
      await A.click(A.btn('Add Product'), 'Add Product');
      await A.see('What are you adding?', 5000);
      await auditAndShoot(A, 'admin', sz.label, 'products-form-empty', issues);

      // 6. Stock tabs
      await D.goSection(A, 'Stock');
      await auditAndShoot(A, 'admin', sz.label, 'stock-all', issues);
      await A.click(ap.getByRole('radio', { name: /History/i }), 'tab History');
      await auditAndShoot(A, 'admin', sz.label, 'stock-history', issues);
      await A.click(ap.getByRole('radio', { name: /To recount/i }), 'tab To recount');
      await auditAndShoot(A, 'admin', sz.label, 'stock-recount', issues);

      // 7. Sales History, Detail sheet, Print previews (Thermal duplicate, A4, Voided), Returns & No-bill return modal
      await D.goSection(A, 'Sale');
      await auditAndShoot(A, 'admin', sz.label, 'sales-history', issues);

      const activeInv = q('SELECT invoice_no FROM sales WHERE is_voided = 0 ORDER BY id DESC LIMIT 1')[0]?.invoice_no;
      const voidInv = q('SELECT invoice_no FROM sales WHERE is_voided = 1 ORDER BY id DESC LIMIT 1')[0]?.invoice_no;

      if (activeInv) {
        await A.click(ap.getByText(activeInv).first(), 'active sale ' + activeInv);
        await auditAndShoot(A, 'admin', sz.label, 'sales-detail-active', issues);

        await A.click(ap.getByRole('dialog').getByRole('button', { name: /Print receipt/i }), 'Print receipt');
        await A.see('DUPLICATE COPY', 8000);
        await auditAndShoot(A, 'admin', sz.label, 'print-thermal-duplicate', issues);
        await A.click(ap.getByRole('dialog').last().getByRole('button', { name: 'Cancel' }), 'close thermal preview');
        await H.sleep(150);

        await A.click(ap.getByRole('dialog').getByRole('button', { name: /A4 invoice/i }), 'A4 invoice');
        await A.see('DUPLICATE COPY', 8000);
        await auditAndShoot(A, 'admin', sz.label, 'print-a4-invoice', issues);
        await POS.closeDialogs(A);
      }

      if (voidInv) {
        await A.click(ap.getByText(voidInv).first(), 'voided sale ' + voidInv);
        await A.click(ap.getByRole('dialog').getByRole('button', { name: /Print receipt/i }), 'Print receipt voided');
        await A.see('*** VOIDED ***', 8000);
        await auditAndShoot(A, 'admin', sz.label, 'print-thermal-voided', issues);
        await POS.closeDialogs(A);
      }

      await A.click(ap.getByRole('radio', { name: /Returns/i }), 'tab Returns');
      await auditAndShoot(A, 'admin', sz.label, 'sales-returns-list', issues);
      await A.click(A.btn(/New Return|Record a return/i), 'New Return');
      await auditAndShoot(A, 'admin', sz.label, 'sales-returns-find', issues);
      await A.click(ap.getByRole('button', { name: 'Return without the bill' }), 'Return without the bill');
      await A.see('Return without the bill', 5000);
      await auditAndShoot(A, 'admin', sz.label, 'sales-no-bill-return-modal', issues);
      await POS.closeDialogs(A);

      // 8. Purchases
      await D.goSection(A, 'Purchase');
      await auditAndShoot(A, 'admin', sz.label, 'purchases-list', issues);

      // 9. Ledgers
      await D.goSection(A, 'Ledgers');
      await auditAndShoot(A, 'admin', sz.label, 'ledgers-home', issues);
      await A.click(ap.getByText('Customer Accounts', { exact: false }).first(), 'Customer Accounts');
      await auditAndShoot(A, 'admin', sz.label, 'ledgers-customers', issues);
      await D.goSection(A, 'Ledgers');
      await A.click(ap.getByText('Supplier Accounts', { exact: false }).first(), 'Supplier Accounts');
      await auditAndShoot(A, 'admin', sz.label, 'ledgers-suppliers', issues);

      // 10. Expenses
      await D.goSection(A, 'Expenses');
      await auditAndShoot(A, 'admin', sz.label, 'expenses-list', issues);
      await A.click(A.btn(/Add Expense/i), 'Add Expense');
      await auditAndShoot(A, 'admin', sz.label, 'expenses-form', issues);

      // 11. Cashiers & Approvals
      await D.goSection(A, 'Cashiers');
      await auditAndShoot(A, 'admin', sz.label, 'cashiers-list', issues);
      await A.click(ap.getByRole('radio', { name: /Sign-in History/i }), 'tab Sign-in History');
      await auditAndShoot(A, 'admin', sz.label, 'cashiers-sessions', issues);
      await A.click(ap.getByRole('radio', { name: /Approvals/i }), 'tab Approvals');
      await auditAndShoot(A, 'admin', sz.label, 'cashiers-approvals', issues);

      // 12. Reports
      await D.goSection(A, 'Reports');
      await auditAndShoot(A, 'admin', sz.label, 'reports-home', issues);
      await A.click(ap.getByText('Sales', { exact: false }).first(), 'report Sales');
      await auditAndShoot(A, 'admin', sz.label, 'reports-sales', issues);
      await D.goSection(A, 'Reports');
      await A.click(ap.getByText('Profit & Loss', { exact: false }).first(), 'report Profit & Loss');
      await auditAndShoot(A, 'admin', sz.label, 'reports-profit-loss', issues);
      await D.goSection(A, 'Reports');
      await A.click(ap.getByText('Stock', { exact: false }).first(), 'report Stock');
      await auditAndShoot(A, 'admin', sz.label, 'reports-stock', issues);

      // 13. Settings tabs
      await D.goSection(A, 'Settings');
      await auditAndShoot(A, 'admin', sz.label, 'settings-letterheads', issues);
      await A.click(ap.getByRole('radio', { name: /Computers & Sync/i }), 'tab Computers & Sync');
      await auditAndShoot(A, 'admin', sz.label, 'settings-sync', issues);
      await A.click(ap.getByRole('radio', { name: /Receipts/i }), 'tab Receipts');
      await auditAndShoot(A, 'admin', sz.label, 'settings-receipts', issues);
      await A.click(ap.getByRole('radio', { name: /Printer/i }), 'tab Printer');
      await auditAndShoot(A, 'admin', sz.label, 'settings-printer', issues);
      await A.click(ap.getByRole('radio', { name: /Backup & Restore/i }), 'tab Backup & Restore');
      await auditAndShoot(A, 'admin', sz.label, 'settings-backup', issues);
      await A.click(ap.getByRole('radio', { name: /General/i }), 'tab General');
      await auditAndShoot(A, 'admin', sz.label, 'settings-general', issues);

      if (issues.length > 0) {
        throw new Error(`Admin visual audit issues at ${sz.label}: ${issues.join(' | ')}`);
      }
    }, A);

    await check('STAGE4-UI', `UI-CASHIER-${sz.label}`, `Cashier window visual & layout audit at ${sz.label} across POS steps and modals`, 'V', async () => {
      const issues = [];
      await setWindowSize(C, sz.width, sz.height);

      await resetPosToIdle(C);
      await auditAndShoot(C, 'cashier', sz.label, 'pos-idle', issues);

      await POS.startSale(C, null);
      await C.press('F7');
      await C.see('Add a missing item', 5000);
      await auditAndShoot(C, 'cashier', sz.label, 'pos-quick-add-modal', issues);
      await POS.closeDialogs(C);

      await POS.addByScan(C, '1001', 2);
      await auditAndShoot(C, 'cashier', sz.label, 'pos-cart-filled', issues);

      await C.press('Tab');
      await C.see('Any discount?', 5000);
      await C.press('Enter');
      if (await C.hasText('How would you like to print the receipt?', 500)) await C.press('Enter');
      await C.see('Amount received', 5000);
      await auditAndShoot(C, 'cashier', sz.label, 'pos-payment-step', issues);

      await resetPosToIdle(C);

      await C.press('F8');
      await C.see("Today's sales", 5000);
      await auditAndShoot(C, 'cashier', sz.label, 'pos-todays-sales-modal', issues);
      await POS.closeDialogs(C);

      if (issues.length > 0) {
        throw new Error(`Cashier visual audit issues at ${sz.label}: ${issues.join(' | ')}`);
      }
    }, C);
  }

  await check('STAGE4-UI', 'UI-S99', 'Restore CLEAN-MASTER after Stage 4 visual audit', 'V', async () => {
    await setWindowSize(A, 1366, 768);
    await setWindowSize(C, 1366, 768);
    A = await D.restoreBackup(A, MASTER_FILE);
    await S.loginIf(A, 'admin', 'Admin@123');
  }, A);

  await rec.stop();
  process.exit(0);
})().catch(async (e) => { console.error(e); process.exit(1); });
