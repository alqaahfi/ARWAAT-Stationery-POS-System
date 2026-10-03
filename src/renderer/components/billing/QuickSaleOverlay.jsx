import React from 'react';
import QuickBillForm from './QuickBillForm';

// The full New Sale form as an overlay on the current page. Opened from a
// customer's profile (customerId locks it to them) or from Sales History
// (no customer: walk-in until one is chosen). Mounts fresh each time it opens.
export default function QuickSaleOverlay({ open, customerId = null, onSaved, onClose }) {
  if (!open) return null;
  return <QuickBillForm kind="sale" presetParty={customerId ? { id: customerId } : null} onSaved={onSaved} onClose={onClose} />;
}
