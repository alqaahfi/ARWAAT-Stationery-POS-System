// Shared DB-side helpers for the shop-day scripts (balances computed exactly like main/ledger/balanceEngine.js).
const H = require('./h');
const { q } = H;
const bal = (name) => q(`select c.opening_balance
  + coalesce((select sum(total_amount) from sales where customer_id=c.id and is_voided=0),0)
  - coalesce((select sum(amount) from payments where party_type='customer' and party_id=c.id and is_voided=0),0)
  + coalesce((select sum(amount) from ledger_adjustments where party_type='customer' and party_id=c.id),0)
  + coalesce((select sum(cash_refund_amount-total_amount) from sale_returns where customer_id=c.id),0) b from customers c where c.name=?`, [name])[0].b;
const sup = (name) => q(`select s.opening_balance + coalesce((select sum(total_amount) from purchases where supplier_id=s.id),0)
  - coalesce((select sum(amount) from payments where party_type='supplier' and party_id=s.id and is_voided=0),0)
  + coalesce((select sum(amount) from ledger_adjustments where party_type='supplier' and party_id=s.id),0) b from suppliers s where s.name=?`, [name])[0].b;
const lastSale = () => q('select s.id, s.invoice_no, s.subtotal, s.discount_amount, s.total_amount, s.paid_amount, s.balance_due, s.is_voided, c.name cust from sales s left join customers c on c.id=s.customer_id order by s.id desc limit 1')[0];
async function loginIf(ui, user, pass) {
  // wait for either the login form or an already signed-in shell
  await Promise.race([
    ui.page.getByLabel('Username').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
    ui.page.getByRole('button', { name: 'Sign out' }).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {}),
  ]);
  if (await ui.page.getByLabel('Username').count()) {
    await ui.type(ui.page.getByLabel('Username'), user, 'username');
    await ui.type(ui.page.getByLabel('Password'), pass, 'password');
    await ui.press('Enter');
    await ui.page.getByRole('button', { name: 'Sign out' }).waitFor({ state: 'visible', timeout: 10000 });
  }
}
module.exports = { bal, sup, lastSale, loginIf };
