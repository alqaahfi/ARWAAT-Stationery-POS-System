import React from 'react';
import theme from '../../../config/theme';
import { Badge } from '../../../components/ui';

const c = theme.colors;

// movement_type -> plain words + color. Starting stock is stored as a
// 'purchase' movement with reference_type 'initial_stock'.
export const MOVE_TYPES = {
  purchase: { label: 'Bought', tone: 'green' },
  sale: { label: 'Sold', tone: 'blue' },
  return_in: { label: 'Customer return', tone: 'teal' },
  return_out: { label: 'Returned to supplier', tone: 'orange' },
  adjustment: { label: 'Fixed', tone: 'orange' },
};

const STARTING = { label: 'Starting stock', tone: 'neutral' };
// Written by the Stock module's Add Stock / Delete Stock forms.
const REFERENCE_LOOK = { initial_stock: STARTING, stock_in: { label: 'Stock added', tone: 'green' }, stock_out: { label: 'Stock removed', tone: 'red' } };

function prettify(raw) {
  const s = String(raw || '').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MoveBadge({ type, referenceType }) {
  const m = REFERENCE_LOOK[referenceType] || MOVE_TYPES[type] || { label: prettify(type), tone: 'neutral' };
  // Badge has no teal tone; tint it from the palette directly.
  const style = m.tone === 'teal' ? { backgroundColor: c.tealTint, color: c.tealText } : undefined;
  return (
    <Badge tone={m.tone === 'teal' ? 'neutral' : m.tone} style={style}>
      {m.label}
    </Badge>
  );
}
