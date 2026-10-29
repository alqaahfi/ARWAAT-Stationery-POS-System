// Visible data entry helpers: everything is typed through the UI, like a person would.
const H = require('./h');

async function goSection(ui, name) {
  await ui.click(ui.page.getByRole('button', { name, exact: true }).first(), `sidebar ${name}`);
  await H.sleep(500);
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
    await H.sleep(300);
    await ui.type(p.getByLabel('Contains').nth(i), String(pk.contains), `contains ${pk.contains}`);
    await ui.type(p.getByLabel('Retail Price').nth(i), String(pk.retail), `retail ${pk.retail}`);
    await ui.type(p.getByLabel('Wholesale Price').nth(i), String(pk.wholesale ?? pk.retail), 'wholesale');
    await ui.type(p.getByLabel('Buying Price').nth(i), String(pk.cost), `cost ${pk.cost}`);
    i++;
  }
  await ui.pause(600);
  await ui.click(ui.btn('Save product'), 'Save product');
}

module.exports = { goSection, addProduct };

const { spawn } = require('child_process');
const path = require('path');
// Starts the UIA helper that answers the next native file dialog; returns a promise for its end.
function answerFileDialog(file) {
  return new Promise((res) => {
    const ps = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '..', 'tools', 'file-dialog.ps1'), file], { stdio: 'inherit' });
    ps.on('close', (c) => res(c));
  });
}

async function setSwitch(ui, label, on) {
  const sw = ui.page.getByRole('switch', { name: label }).first();
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

async function addParty(ui, kind, { name, phone, owed, advance }) {
  const p = ui.page;
  await goSection(ui, kind === 'customer' ? 'Customers' : 'Suppliers');
  await ui.click(ui.btn(kind === 'customer' ? /Add Customer|New Customer/ : /Add Supplier|New Supplier/), `Add ${kind}`);
  await ui.type(p.getByLabel('Name *'), name, `name ${name}`);
  if (phone) await ui.type(p.getByLabel('Phone', { exact: true }), phone, `phone ${phone}`);
  if (owed || advance) {
    await ui.click(p.getByText(advance ? /^Advance \(/ : /^Owed \(/).first(), advance ? 'Advance' : 'Owed');
    await ui.type(p.getByPlaceholder('0').last(), String(owed || advance), `starting balance ${owed || advance}`);
  }
  await ui.click(ui.btn(kind === 'customer' ? 'Save customer' : 'Save supplier'), `Save ${kind}`);
}

Object.assign(module.exports, { answerFileDialog, setSwitch, addCashier, addParty });

const BACKUPS = require('path').join(H.ROOT, 'test-backups');
async function openBackupTab(ui) {
  await goSection(ui, 'Settings');
  await ui.click(ui.page.getByText('Backup & Restore', { exact: true }).first(), 'tab Backup & Restore');
}
async function makeBackup(ui, name) {
  const file = require('path').join(BACKUPS, name + '.db');
  try { require('fs').rmSync(file); } catch {}
  await openBackupTab(ui);
  const dlg = answerFileDialog(file);
  await ui.click(ui.btn('Create a backup'), 'Create a backup');
  await dlg;
  await ui.see('ackup', 8000);
  await H.sleep(800);
  if (!require('fs').existsSync(file)) throw new Error('backup file was not written: ' + file);
  return file;
}
// Restore replaces the DB and the app relaunches itself; wait for it to come back.
async function restoreBackup(ui, file, mode = 'admin') {
  await openBackupTab(ui);
  const dlg = answerFileDialog(file);
  await ui.click(ui.btn('Choose a backup file'), 'Choose a backup file');
  // confirm dialog from the app (may appear before or after the file dialog)
  const confirm = ui.page.getByRole('button', { name: /Restore|Yes|Continue/ }).last();
  await Promise.race([confirm.waitFor({ timeout: 6000 }).then(() => ui.click(confirm, 'confirm restore')).catch(() => {}), H.sleep(6500)]);
  await dlg;
}
Object.assign(module.exports, { BACKUPS, openBackupTab, makeBackup, restoreBackup });
