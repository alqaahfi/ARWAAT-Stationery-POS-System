import React from 'react';
import QuickBillForm from './QuickBillForm';

// The same form as the quick sale, with a supplier instead of a customer.
// Opened from a supplier's profile (supplierId locks it to them) or from
// Purchase History (the supplier is chosen inside).
export default function QuickPurchaseOverlay({ open, supplierId = null, onSaved, onClose }) {
  if (!open) return null;
  return <QuickBillForm kind="purchase" presetParty={supplierId ? { id: supplierId } : null} onSaved={onSaved} onClose={onClose} />;
}
