// Human-style, mostly keyboard-driven helpers for the POS (Sale.jsx stage machine).
const H = require('./h');

async function login(ui, username, password) {
  const p = ui.page;
  await ui.type(p.getByLabel('Username'), username, `username ${username}`);
  await ui.type(p.getByLabel('Password'), password, 'password');
  await ui.press('Enter');
}

// Starts a new sale from idle (S) and chooses the customer (name text or null = walk-in).
async function startSale(ui, customer) {
  await closeDialogs(ui);
  if (await ui.hasText('unfinished sale', 500)) await ui.press('n'); else await ui.press('s');
  await ui.see('Who is this sale for?');
  if (customer) {
    await ui.page.keyboard.type(customer, { delay: H.S.keyDelay });
    // wait for the customer result to be listed (debounced search), then choose it
    await ui.page.getByText(customer, { exact: false }).nth(1).waitFor({ state: 'visible', timeout: 6000 });
    await ui.press('Enter');
  } else {
    await ui.press('Tab');
  }
  await ui.see('Add items', 8000); // the item stage; the step strip always says "Items", so wait for this heading
}

// Type a product name, take the first result (default pack size), or move to a pack size with Tab + arrows.
async function addByName(ui, name, qty, { pack } = {}) {
  await ui.page.keyboard.type(name, { delay: H.S.keyDelay });
  await ui.page.locator('[role="listbox"] [role="option"]').first().waitFor({ state: 'visible', timeout: 6000 });
  if (pack) {
    await ui.press('Tab');
    for (let i = 0; i < pack; i++) {
      await ui.press('ArrowRight');
    }
  } // pack = 1 -> second pack size (Box)
  await ui.press('Enter');
  await qtyStage(ui, qty);
}
async function qtyStage(ui, qty) {
  await ui.see('How many?', 5000);
  if (qty !== undefined && String(qty) !== '1') {
    await ui.press('Control+A');
    await ui.page.keyboard.type(String(qty), { delay: H.S.keyDelay });
  }
  await ui.press('Enter');
  await ui.see('Add items', 5000);
}
async function addByScan(ui, code, qty) {
  await ui.scan(code);
  await qtyStage(ui, qty);
}

// From the item stage: Tab -> discount (default Percent), Enter -> format, Enter -> payment, Enter -> saved.
async function discountAndPay(ui, { discount, pay, format } = {}) {
  await ui.press('Tab');
  await ui.see('Any discount?', 5000);
  if (discount) {
    if (discount.amount !== undefined) await ui.click(ui.page.getByText('Amount', { exact: true }).first(), 'discount Amount');
    await ui.page.keyboard.type(String(discount.amount !== undefined ? discount.amount : discount.percent), { delay: H.S.keyDelay });
  }
  await ui.press('Enter');
  // Either receipt format step or straight to payment step
  await Promise.race([
    ui.see('How would you like to print the receipt?', 4000),
    ui.see('How much did the customer pay?', 4000),
  ]).catch(() => {});
  if (await ui.hasText('How would you like to print the receipt?', 300)) {
    if (format) await ui.press(String(format));
    await ui.press('Enter');
  }
  await ui.see('How much did the customer pay?', 5000);
  if (pay !== undefined && pay !== 'exact') await ui.page.keyboard.type(String(pay), { delay: H.S.keyDelay });
  await ui.press('Enter');
}
async function finishSale(ui) {
  await ui.see('Sale complete', 8000);
  const body = await ui.body();
  finishSale.lastBody = body;
  const inv = (body.match(/Invoice: (\S+)/) || [])[1];
  await ui.pause();
  await ui.press('Enter'); // close the sheet
  await closeDialogs(ui); // if Print Preview opens after a sale
  return inv;
}

async function closeDialogs(ui) {
  for (let i = 0; i < 3; i++) {
    if (!(await ui.page.locator('[role=dialog]').count())) return;
    await ui.press('Escape');
    await ui.page.locator('[role=dialog]').first().waitFor({ state: 'detached', timeout: 1500 }).catch(() => {});
  }
}

module.exports = { closeDialogs, login, startSale, addByName, addByScan, qtyStage, discountAndPay, finishSale };
