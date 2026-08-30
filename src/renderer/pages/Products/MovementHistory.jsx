import React from 'react';
import PlaceholderPage from '../../components/PlaceholderPage';

// Not yet built — this pass only moved Inventory's routes under Products
// (was /inventory/movements). The stock_movements table is already populated
// by every purchase/sale/adjustment; this page just needs a read-only view
// over it, which is a separate future build.
// Accepts an optional productId (the All Products page's "View Movement
// History" action pre-fills it) so that pre-fill support already exists once
// this page's real view is built.
export default function MovementHistory({ productId }) {
  return <PlaceholderPage title={productId ? `Stock Movement History — Product #${productId}` : 'Stock Movement History'} />;
}
