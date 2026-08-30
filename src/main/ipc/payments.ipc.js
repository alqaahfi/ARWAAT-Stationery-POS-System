const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
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

  db.prepare(
    `INSERT INTO payments (party_type, party_id, sale_id, amount, payment_method, note, received_by)
     VALUES ('customer', ?, NULL, ?, ?, ?, ?)`
  ).run(customerId, amt, paymentMethod, note || null, receivedBy || null);

  return { success: true, newBalance: getCustomerBalance(db, customerId) };
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
  db.prepare(
    `INSERT INTO payments (party_type, party_id, sale_id, amount, payment_method, note, received_by)
     VALUES ('supplier', ?, NULL, ?, ?, ?, ?)`
  ).run(supplierId, amt, paymentMethod, note || null, receivedBy || null);

  return { success: true, newBalance: getSupplierBalance(db, supplierId) };
}

function registerPaymentsIpc() {
  ipcMain.handle('payments:create-standalone', (event, payload) => createStandalone(payload || {}));
  ipcMain.handle('payments:create-supplier-payment', (event, payload) => createSupplierPayment(payload || {}));
}

module.exports = { registerPaymentsIpc };
