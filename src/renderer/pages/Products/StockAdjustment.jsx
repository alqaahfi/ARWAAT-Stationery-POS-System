import React from 'react';
import PlaceholderPage from '../../components/PlaceholderPage';

// Not yet built — this pass only moved Inventory's routes under Products
// (was /inventory/adjustments). The actual manual stock-adjustment workflow
// (reason codes, +/- quantity, approval) is a separate future build.
// Accepts an optional productId (the All Products page's "Adjust Stock"
// action pre-fills it) so that pre-fill support already exists once this
// page's real form is built.
export default function StockAdjustment({ productId }) {
  return <PlaceholderPage title={productId ? `Stock Adjustments — Product #${productId}` : 'Stock Adjustments'} />;
}
