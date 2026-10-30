// Rule 2: a customer's credit limit is a WARNING only — it never blocks a sale.
// The screen asks this before saving a credit (udhaar) sale and shows the
// message with the numbers; the cashier can accept and save anyway.
const { getCustomerBalance } = require('./balanceEngine');

function money(db, n) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'currency_symbol'").get();
  const symbol = (row && row.value) || 'Rs.';
  const value = Math.round((Number(n) || 0) * 100) / 100;
  const text = value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${symbol} ${text}`;
}

// addAmount = what this bill leaves unpaid (total − paid). excludeSaleId: the
// bill being edited, whose own unpaid part is already inside the balance.
function creditLimitCheck(db, { customerId, addAmount, excludeSaleId } = {}) {
  const customer = customerId ? db.prepare('SELECT id, name, credit_limit FROM customers WHERE id = ?').get(customerId) : null;
  if (!customer) return { success: true, applies: false, overLimit: false };
  const limit = Number(customer.credit_limit) || 0;
  let balanceBefore = getCustomerBalance(db, customer.id);
  if (excludeSaleId) {
    const own = db
      .prepare('SELECT total_amount, paid_amount FROM sales WHERE id = ? AND customer_id = ? AND is_voided = 0')
      .get(excludeSaleId, customer.id);
    if (own) balanceBefore -= own.total_amount - own.paid_amount;
  }
  const add = Number(addAmount) || 0;
  const balanceAfter = Math.round((balanceBefore + add) * 100) / 100;
  const applies = limit > 0;
  const overLimit = applies && add > 0.005 && balanceAfter > limit + 0.005;
  return {
    success: true,
    applies,
    overLimit,
    limit,
    balanceBefore,
    balanceAfter,
    customerName: customer.name,
    message: overLimit
      ? `This puts ${customer.name} at ${money(db, balanceAfter)}, over their credit limit of ${money(db, limit)}.`
      : null,
  };
}

module.exports = { creditLimitCheck };
