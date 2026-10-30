// Visible data entry helpers: everything is typed through the UI, like a person would.
const fs = require('fs');
const path = require('path');
const H = require('./h');

async function goSection(ui, name) {
  await ui.click(ui.page.getByRole('button', { name, exact: true }).first(), `sidebar ${name}`);
}

// product = { name, barcode, stock, retail, cost, wholesale?, packs: [{ preset:'Box', contains, retail, cost }] }
async function addProduct(ui, pr) {
  const p = ui.page;
  await goSection(ui, 'Products');
  await ui.click(ui.btn('Add Product'), 'Add Product');
  await ui.see('What are you adding?');
  await ui.type(p.getByLabel('Name *'), pr.name, `name ${pr.name}`);
  if (pr.barcode) await ui.type(p.getByLabel('Barcode').first(), pr.barcode, `barcode ${pr.barcode}`);
  if (pr.stock !== undefined) await ui.type(p.getByLabel('Starting stock'), String(pr.stock), `stock ${pr.stock}`);
  // first pack size card (Piece) is already there
  await ui.type(p.getByLabel('Retail Price').first(), String(pr.retail), `retail ${pr.retail}`);
  await ui.type(p.getByLabel('Wholesale Price').first(), String(pr.wholesale ?? pr.retail), 'wholesale');
  await ui.type(p.getByLabel('Buying Price').first(), String(pr.cost), `cost ${pr.cost}`);
  let i = 1;
  for (const pk of pr.packs || []) {
    await ui.click(p.getByRole('button', { name: pk.preset, exact: true }).first(), `add pack size ${pk.preset}`);
    await p.getByLabel('Contains').nth(i).waitFor({ state: 'visible', timeout: 5000 });
    await ui.type(p.getByLabel('Contains').nth(i), String(pk.contains), `contains ${pk.contains}`);
    await ui.type(p.getByLabel('Retail Price').nth(i), String(pk.retail), `retail ${pk.retail}`);
    await ui.type(p.getByLabel('Wholesale Price').nth(i), String(pk.wholesale ?? pk.retail), 'wholesale');
    await ui.type(p.getByLabel('Buying Price').nth(i), String(pk.cost), `cost ${pk.cost}`);
    i++;
  }
  await ui.click(ui.btn('Save product'), 'Save product');
}

// Sets the file path consumed by the main process when ARWAAT_TEST_MODE=1.
function answerFileDialog(file) {
  H.setDialogFile(file);
  return Promise.resolve(0);
}

async function setSwitch(ui, label, on) {
  const sw = ui.page.getByRole('switch', { name: label }).first();
  await sw.waitFor({ state: 'visible', timeout: 5000 });
  const cur = (await sw.getAttribute('aria-checked')) === 'true';
  if (cur !== on) await ui.click(sw, `switch ${label}`);
}

async function addCashier(ui, { fullName, username, password, perms, discount }) {
  const p = ui.page;
  await goSection(ui, 'Cashiers');
  await ui.click(ui.btn(/Add Cashier|New Cashier/), 'Add Cashier');
  await ui.type(p.getByLabel('Full name *'), fullName, 'full name');
  await ui.type(p.getByLabel('Username *'), username, 'username');
  await ui.type(p.getByLabel('Password *', { exact: true }), password, 'password');
  await ui.type(p.getByLabel('Confirm password *'), password, 'confirm');
  for (const k of perms) await setSwitch(ui, k, true);
  if (discount !== undefined) await ui.type(p.getByLabel('Maximum Discount').first(), String(discount), `max discount ${discount}`);
  await ui.click(ui.btn('Save cashier'), 'Save cashier');
}

async function addParty(ui, kind, { name, phone, owed, advance, creditLimit }) {
  const p = ui.page;
  await goSection(ui, kind === 'customer' ? 'Customers' : 'Suppliers');
  await ui.click(ui.btn(kind === 'customer' ? /Add Customer|New Customer/ : /Add Supplier|New Supplier/), `Add ${kind}`);
  await ui.type(p.getByLabel('Name *'), name, `name ${name}`);
  if (phone) await ui.type(p.getByLabel('Phone', { exact: true }), phone, `phone ${phone}`);
  if (owed || advance) {
    await ui.click(p.getByText(advance ? /^Advance \(/ : /^Owed \(/).first(), advance ? 'Advance' : 'Owed');
    await ui.type(p.getByPlaceholder('0').last(), String(owed || advance), `starting balance ${owed || advance}`);
  }
  if (creditLimit !== undefined && kind === 'customer') {
    const cl = p.getByLabel(/Credit limit/i).first();
    if (await cl.count()) await ui.type(cl, String(creditLimit), `credit limit ${creditLimit}`);
  }
  await ui.click(ui.btn(kind === 'customer' ? 'Save customer' : 'Save supplier'), `Save ${kind}`);
}

const BACKUPS = path.join(H.ROOT, 'test-backups');
async function openBackupTab(ui) {
  await goSection(ui, 'Settings');
  await ui.click(ui.page.getByText('Backup & Restore', { exact: true }).first(), 'tab Backup & Restore');
  await ui.see('Back up your shop', 8000);
}
async function makeBackup(ui, name) {
  const file = path.join(BACKUPS, name + '.db');
  fs.mkdirSync(BACKUPS, { recursive: true });
  for (const ext of ['', '-wal', '-shm']) { try { fs.rmSync(file + ext); } catch {} }
  await openBackupTab(ui);
  H.setDialogFile(file);
  await ui.click(ui.btn('Create a backup'), 'Create a backup');
  await ui.see('Last saved to', 10000);
  if (!fs.existsSync(file)) throw new Error('backup file was not written: ' + file);
  return file;
}
// Restore replaces the DB and prompts to restart; if expectError is false, restarts and re-attaches.
async function restoreBackup(ui, file, { mode = 'admin', restart = true, expectError = false } = {}) {
  await openBackupTab(ui);
  H.setDialogFile(file);
  await ui.click(ui.btn('Choose a backup file'), 'Choose a backup file');
  // Confirmation modal (role="alertdialog") opens before main process file picker is called
  const confirmBtn = ui.page.locator('[role="alertdialog"], [role="dialog"]').getByRole('button', { name: 'Restore', exact: true });
  await confirmBtn.waitFor({ state: 'visible', timeout: 6000 });
  await ui.click(confirmBtn, 'confirm Restore');
  if (expectError) {
    await ui.see("doesn't look like a valid ARWAAT POS backup", 8000);
    return ui;
  }
  await ui.see('Backup restored', 10000);
  if (restart) {
    await ui.click(ui.page.getByRole('button', { name: /Restart now/i }).first(), 'Restart now');
    return H.openApp(mode, { fresh: true });
  }
  return ui;
}
module.exports = { goSection, addProduct, answerFileDialog, setSwitch, addCashier, addParty, BACKUPS, openBackupTab, makeBackup, restoreBackup };
