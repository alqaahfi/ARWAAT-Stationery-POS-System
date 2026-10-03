// Customer returns as account-ledger rows, so the customer account timeline
// includes them the same way the balance engine does. A return lowers what
// the customer owes by its total, minus any cash handed back for it — so its
// signed effect is −(total − cash_refund), always ≤ 0. Sorted after sales,
// payments and corrections at the same timestamp.
function getReturnRows(db, customerId) {
  return db
    .prepare(
      `SELECT id, return_no, total_amount, cash_refund_amount, reason, created_at
       FROM sale_returns WHERE customer_id = ? ORDER BY created_at`
    )
    .all(customerId)
    .map((r) => {
      const effect = -(r.total_amount - r.cash_refund_amount);
      return {
        date: r.created_at,
        type: 'return',
        reference: r.return_no,
        note: null,
        reason: r.reason,
        amount: effect,
        total_amount: r.total_amount,
        cash_refund_amount: r.cash_refund_amount,
        debit: 0,
        credit: -effect,
        sortKey: `${r.created_at}_3_${r.id}`,
      };
    });
}

module.exports = { getReturnRows };
