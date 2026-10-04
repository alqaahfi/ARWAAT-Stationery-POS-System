import React from 'react';
import MovementHistory from '../Products/MovementHistory';

// Stock → History (/stock/history): every row of stock_movements — purchases,
// sales, returns, fixes and the Add / Delete Stock forms — with the same
// filters as the Stock History table. A productId (from a Product Profile's
// "Full history") pre-filters it to that product.
export default function StockHistory({ productId }) {
  return <MovementHistory productId={productId} />;
}
