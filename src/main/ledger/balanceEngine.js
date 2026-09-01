// Neither a customer's nor a supplier's running balance is ever stored
// directly — both are always derived from opening_balance + their side of
// the ledger - their payments + any manual ledger_adjustments. Customer and
// supplier balances are the same pattern (only the "other side" table
// differs — sales vs. purchases), so both live together here rather than in
// a customers-only file.
//
// This is the single source of truth for both balances — Customer/Supplier
// Ledger, the Ledgers module (Overview, Advances & Credits, Aging, Manual
// Adjustments), Reports' Customer/Supplier Statements, and the Dashboard all
// call into this file rather than each computing their own version.

function getAdjustmentsTotal(db, partyType, partyId) {
  return db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_adjustments WHERE party_type = ? AND party_id = ?')
    .get(partyType, partyId).total;
}

function getAdjustmentTotalsMap(db, partyType, partyIds) {
  if (!partyIds || partyIds.length === 0) return {};
  const placeholders = partyIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT party_id, COALESCE(SUM(amount), 0) AS total FROM ledger_adjustments
       WHERE party_type = ? AND party_id IN (${placeholders}) GROUP BY party_id`
    )
    .all(partyType, ...partyIds);
  return Object.fromEntries(rows.map((r) => [r.party_id, r.total]));
}

function getCustomerBalance(db, customerId) {
  const customer = db.prepare('SELECT opening_balance FROM customers WHERE id = ?').get(customerId);
  if (!customer) return 0;

  const salesTotal = db
    .prepare('SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE customer_id = ?')
    .get(customerId).total;
  const paymentsTotal = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE party_type = 'customer' AND party_id = ?")
    .get(customerId).total;
  const adjustmentsTotal = getAdjustmentsTotal(db, 'customer', customerId);

  return customer.opening_balance + salesTotal - paymentsTotal + adjustmentsTotal;
}

// Batch version for list views — one aggregate query per table (grouped by
// customer) instead of N+1 single-customer balance queries per row.
function getBalancesForCustomers(db, customerIds) {
  if (!customerIds || customerIds.length === 0) return {};

  const placeholders = customerIds.map(() => '?').join(',');

  const openings = db
    .prepare(`SELECT id, opening_balance FROM customers WHERE id IN (${placeholders})`)
    .all(...customerIds);
  const salesRows = db
    .prepare(`SELECT customer_id, COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE customer_id IN (${placeholders}) GROUP BY customer_id`)
    .all(...customerIds);
  const paymentRows = db
    .prepare(
      `SELECT party_id, COALESCE(SUM(amount), 0) AS total FROM payments WHERE party_type = 'customer' AND party_id IN (${placeholders}) GROUP BY party_id`
    )
    .all(...customerIds);

  const salesMap = Object.fromEntries(salesRows.map((r) => [r.customer_id, r.total]));
  const paymentMap = Object.fromEntries(paymentRows.map((r) => [r.party_id, r.total]));
  const adjustmentMap = getAdjustmentTotalsMap(db, 'customer', customerIds);

  const result = {};
  for (const c of openings) {
    result[c.id] = c.opening_balance + (salesMap[c.id] || 0) - (paymentMap[c.id] || 0) + (adjustmentMap[c.id] || 0);
  }
  return result;
}

// Positive = the shop owes the supplier.
function getSupplierBalance(db, supplierId) {
  const supplier = db.prepare('SELECT opening_balance FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) return 0;

  const purchasesTotal = db
    .prepare('SELECT COALESCE(SUM(total_amount), 0) AS total FROM purchases WHERE supplier_id = ?')
    .get(supplierId).total;
  const paymentsTotal = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE party_type = 'supplier' AND party_id = ?")
    .get(supplierId).total;
  const adjustmentsTotal = getAdjustmentsTotal(db, 'supplier', supplierId);

  return supplier.opening_balance + purchasesTotal - paymentsTotal + adjustmentsTotal;
}

function getBalancesForSuppliers(db, supplierIds) {
  if (!supplierIds || supplierIds.length === 0) return {};

  const placeholders = supplierIds.map(() => '?').join(',');

  const openings = db
    .prepare(`SELECT id, opening_balance FROM suppliers WHERE id IN (${placeholders})`)
    .all(...supplierIds);
  const purchaseRows = db
    .prepare(`SELECT supplier_id, COALESCE(SUM(total_amount), 0) AS total FROM purchases WHERE supplier_id IN (${placeholders}) GROUP BY supplier_id`)
    .all(...supplierIds);
  const paymentRows = db
    .prepare(
      `SELECT party_id, COALESCE(SUM(amount), 0) AS total FROM payments WHERE party_type = 'supplier' AND party_id IN (${placeholders}) GROUP BY party_id`
    )
    .all(...supplierIds);

  const purchaseMap = Object.fromEntries(purchaseRows.map((r) => [r.supplier_id, r.total]));
  const paymentMap = Object.fromEntries(paymentRows.map((r) => [r.party_id, r.total]));
  const adjustmentMap = getAdjustmentTotalsMap(db, 'supplier', supplierIds);

  const result = {};
  for (const s of openings) {
    result[s.id] = s.opening_balance + (purchaseMap[s.id] || 0) - (paymentMap[s.id] || 0) + (adjustmentMap[s.id] || 0);
  }
  return result;
}

module.exports = {
  getCustomerBalance,
  getBalancesForCustomers,
  getSupplierBalance,
  getBalancesForSuppliers,
};
