// Balance corrections (ledger_adjustments) as account-ledger rows, so the
// customer/supplier account timelines include them the same way the balance
// engine does. Positive amount = the party's balance goes up (debit),
// negative = it goes down (credit). Sorted after sales/purchases/payments at
// the same timestamp.
function getAdjustmentRows(db, partyType, partyId) {
  return db
    .prepare('SELECT id, amount, reason, created_at FROM ledger_adjustments WHERE party_type = ? AND party_id = ? ORDER BY created_at')
    .all(partyType, partyId)
    .map((a) => ({
      date: a.created_at,
      type: 'adjustment',
      reference: null,
      note: a.reason,
      reason: a.reason,
      amount: a.amount,
      debit: a.amount > 0 ? a.amount : 0,
      credit: a.amount < 0 ? -a.amount : 0,
      sortKey: `${a.created_at}_2_${a.id}`,
    }));
}

module.exports = { getAdjustmentRows };
