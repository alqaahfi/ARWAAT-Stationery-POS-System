const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { withCallerId } = require('../security/ipcGuard');
const { getCustomerBalance, getSupplierBalance } = require('../ledger/balanceEngine');

// The standalone Record Payment screen only ever records a customer payment
// with no linked sale. Overpayment isn't blocked here — the renderer confirms
// with the user first, then this handler just records whatever was confirmed.
function createStandalone({ customerId, amount, paymentMethod, note, receivedBy }) {
  const db = getDb();

  if (!customerId) return { success: false, reason: 'Select a customer.' };
  const amt = Number(amount);
  if (!amt || amt <= 0) return { success: false, reason: 'Enter an amount greater than zero.' };
  if (!['cash', 'bank', 'other'].includes(paymentMethod)) return { success: false, reason: 'Invalid payment method.' };

  const result = db.prepare(
    `INSERT INTO payments (party_type, party_id, sale_id, amount, payment_method, note, received_by)
     VALUES ('customer', ?, NULL, ?, ?, ?, ?)`
  ).run(customerId, amt, paymentMethod, note || null, receivedBy || null);

  return { success: true, paymentId: result.lastInsertRowid, newBalance: getCustomerBalance(db, customerId) };
}

// Admin-only, enforced here rather than just hidden in the UI — the
// Suppliers module has no cashier access at all, unlike Customers.
function createSupplierPayment({ supplierId, amount, paymentMethod, note, receivedBy, requestingUserId }) {
  const db = getDb();

  const requester = requestingUserId ? db.prepare('SELECT role FROM users WHERE id = ?').get(requestingUserId) : null;
  if (!requester || requester.role !== 'admin') {
    return { success: false, reason: 'This action is restricted to Admin accounts.' };
  }

  if (!supplierId) return { success: false, reason: 'Select a supplier.' };
  const amt = Number(amount);
  if (!amt || amt <= 0) return { success: false, reason: 'Enter an amount greater than zero.' };
  if (!['cash', 'bank', 'other'].includes(paymentMethod)) return { success: false, reason: 'Invalid payment method.' };

  // received_by is reused as-is even though this is an outgoing payment —
  // the direction is implied by party_type, so no schema change is needed.
  const result = db.prepare(
    `INSERT INTO payments (party_type, party_id, sale_id, amount, payment_method, note, received_by)
     VALUES ('supplier', ?, NULL, ?, ?, ?, ?)`
  ).run(supplierId, amt, paymentMethod, note || null, receivedBy || null);

  return { success: true, paymentId: result.lastInsertRowid, newBalance: getSupplierBalance(db, supplierId) };
}

// Admin-only. Removes one payment (either direction, any origin) and puts back
// everything it had changed. Customer / supplier balances are always derived
// from the payments table, so removing the row is what reverses the ledger.
// The bill-level snapshot figures that were bumped when the money was taken
// are put back too, so a sale or purchase does not keep claiming it was paid:
//   - a payment linked to a sale lowers that sale's paid_amount (and its
//     balance due / status);
//   - a payment that was recorded together with a purchase lowers that
//     purchase's paid_amount (matched by supplier, amount and time, since the
//     link is not stored).
function deletePayment({ paymentId, requestingUserId } = {}) {
  const db = getDb();

  const requester = requestingUserId ? db.prepare('SELECT role FROM users WHERE id = ?').get(requestingUserId) : null;
  if (!requester || requester.role !== 'admin') {
    return { success: false, reason: 'This action is restricted to Admin accounts.' };
  }
  const payment = paymentId ? db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) : null;
  if (!payment) return { success: false, reason: 'This payment was already removed.' };

  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  const run = db.transaction(() => {
    if (payment.sale_id) {
      const sale = db.prepare('SELECT total_amount, paid_amount FROM sales WHERE id = ?').get(payment.sale_id);
      if (sale) {
        const paid = Math.max(0, round2(sale.paid_amount - payment.amount));
        const due = Math.max(0, round2(sale.total_amount - paid));
        const status = due <= 0.005 ? 'paid' : paid <= 0.005 ? 'unpaid' : 'partial';
        db.prepare('UPDATE sales SET paid_amount = ?, balance_due = ?, payment_status = ? WHERE id = ?').run(paid, due, status, payment.sale_id);
      }
    } else if (payment.party_type === 'supplier' && /^Paid with purchase/.test(payment.note || '')) {
      const purchase = db
        .prepare(
          `SELECT id, paid_amount FROM purchases
           WHERE supplier_id = ? AND paid_amount >= ? - 0.005
           ORDER BY ABS(strftime('%s', purchase_date) - strftime('%s', ?)) LIMIT 1`
        )
        .get(payment.party_id, payment.amount, payment.created_at);
      if (purchase) {
        db.prepare('UPDATE purchases SET paid_amount = ? WHERE id = ?').run(Math.max(0, round2(purchase.paid_amount - payment.amount)), purchase.id);
      }
    }
    db.prepare('DELETE FROM payments WHERE id = ?').run(payment.id);
  });

  try {
    run();
  } catch (err) {
    return { success: false, reason: err.message || 'Could not delete the payment.' };
  }

  const newBalance = payment.party_type === 'supplier' ? getSupplierBalance(db, payment.party_id) : getCustomerBalance(db, payment.party_id);
  return { success: true, partyType: payment.party_type, partyId: payment.party_id, newBalance };
}

function registerPaymentsIpc() {
  ipcMain.handle('payments:delete', (event, payload) => deletePayment(withCallerId(event, payload, 'requestingUserId')));
  ipcMain.handle('payments:create-standalone', (event, payload) => createStandalone(withCallerId(event, payload, 'receivedBy')));
  ipcMain.handle('payments:create-supplier-payment', (event, payload) =>
    createSupplierPayment(withCallerId(event, payload, 'requestingUserId', 'receivedBy'))
  );
}

module.exports = { registerPaymentsIpc };
