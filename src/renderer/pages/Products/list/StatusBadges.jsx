import React from 'react';
import { Clock } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Icon } from '../../../components/ui';

// The flags (isOutOfStock / isLow / isDead) come straight from the list rows,
// computed in main by Product.js — never re-derived here.
export function statusList(row) {
  const list = [];
  if (row.isOutOfStock) list.push({ key: 'out', label: glossary.outOfStock, tone: 'red' });
  else if (row.isLow) list.push({ key: 'low', label: glossary.runningLow, tone: 'orange' });
  if (row.isDead) list.push({ key: 'dead', label: glossary.notSelling, tone: 'neutral', icon: Clock });
  if (!row.is_active) list.push({ key: 'inactive', label: glossary.inactive, tone: 'neutral' });
  return list;
}

// Plain-text status, used by the CSV export.
export function statusLabel(row) {
  const labels = statusList(row)
    .filter((s) => s.key !== 'inactive')
    .map((s) => s.label);
  return labels.length ? labels.join(', ') : 'In stock';
}

export function StatusBadges({ row }) {
  const list = statusList(row);
  if (!list.length) return <span style={{ ...theme.type.footnote, color: theme.colors.labelTertiary }}>In stock</span>;
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {list.map((s) => (
        <Badge key={s.key} tone={s.tone} size="sm">
          {s.icon && <Icon icon={s.icon} size={12} />}
          {s.label}
        </Badge>
      ))}
    </div>
  );
}

const DOT_COLORS = { red: 'red', orange: 'orange', neutral: 'gray' };

// Dot + text for the dense Compact view (the first status wins).
export function StatusDot({ row }) {
  const first = statusList(row)[0];
  const color = first ? theme.colors[DOT_COLORS[first.tone]] : theme.colors.green;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...theme.type.footnote, color: theme.colors.labelSecondary, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: theme.radius.pill, backgroundColor: color, flexShrink: 0 }} />
      {first ? first.label : 'In stock'}
    </span>
  );
}
