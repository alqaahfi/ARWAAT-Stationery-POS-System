import React from 'react';
import { X } from 'lucide-react';
import theme from '../../../config/theme';
import { Icon, SearchField, Select, TextInput } from '../../../components/ui';
import { formatCount, formatDateOnly } from '../../../utils/format';
import { MoveBadge, MOVE_TYPES } from './MoveBadge';
import { TwoLine } from './StockTable';

const c = theme.colors;

export function HistoryToolbar({ productName, onClearProduct, search, onSearch, movementType, onMovementType, dateFrom, onDateFrom, dateTo, onDateTo }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
      {productName ? (
        <button
          type="button"
          onClick={onClearProduct}
          aria-label={`Remove filter: ${productName}`}
          title="Show all items"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: theme.control.input,
            padding: '0 10px 0 14px',
            borderRadius: theme.radius.pill,
            border: `1px solid ${c.accent}`,
            backgroundColor: c.accentTint,
            color: c.accent,
            fontFamily: theme.font.family,
            ...theme.type.subhead,
            fontWeight: theme.font.weightSemibold,
            cursor: 'pointer',
          }}
        >
          Item: {productName}
          <Icon icon={X} size={16} />
        </button>
      ) : (
        <SearchField value={search} onChange={onSearch} placeholder="Search item name or code" aria-label="Search items" style={{ flex: 1, minWidth: '220px' }} />
      )}
      <Select aria-label="Type of change" value={movementType} onChange={(e) => onMovementType(e.target.value)} style={{ width: '200px' }}>
        <option value="">All changes</option>
        {Object.entries(MOVE_TYPES).map(([code, m]) => (
          <option key={code} value={code}>
            {m.label}
          </option>
        ))}
      </Select>
      <label style={dateLabel}>
        From
        <TextInput type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} style={{ width: '150px' }} />
      </label>
      <label style={dateLabel}>
        To
        <TextInput type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} style={{ width: '150px' }} />
      </label>
    </div>
  );
}

const dateLabel = { display: 'inline-flex', alignItems: 'center', gap: '6px', ...theme.type.subhead, color: c.labelSecondary };

function timeOf(iso) {
  const d = new Date(String(iso).replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Whatever the row can tell: invoice number, purchase reference, or reason + note.
function details(r) {
  if (r.reference_type === 'purchase') return r.purchase_reference_no ? `Purchase ${r.purchase_reference_no}` : `Purchase #${r.reference_id}`;
  if (r.reference_type === 'sale') return r.sale_invoice_no ? `Invoice ${r.sale_invoice_no}` : `Sale #${r.reference_id}`;
  if (r.reference_type === 'return') return r.return_no ? `Return ${r.return_no}` : r.note || `Return #${r.reference_id}`;
  if (r.reference_type === 'initial_stock') return r.note || 'Starting stock';
  if (r.reference_type === 'stock_in' || r.reference_type === 'stock_out') return r.note || '—';
  if (r.reference_type === 'adjustment') return r.note || 'Fixed by hand';
  return r.note || '—';
}

export const historyColumns = [
  { key: 'when', label: 'When', width: '130px', render: (r) => <TwoLine title={formatDateOnly(r.created_at)} sub={timeOf(r.created_at)} /> },
  {
    key: 'item',
    label: 'Item',
    render: (r) => <TwoLine title={r.product_name} sub={r.variant_name !== 'Standard' ? r.variant_name : null} />,
  },
  { key: 'type', label: 'What happened', width: '170px', render: (r) => <MoveBadge type={r.movement_type} referenceType={r.reference_type} /> },
  {
    key: 'change',
    label: 'Change',
    numeric: true,
    width: '120px',
    render: (r) => (
      <span style={{ fontWeight: theme.font.weightSemibold, color: r.quantity > 0 ? c.greenText : c.redText }}>
        {r.quantity > 0 ? '+' : '−'}
        {formatCount(Math.abs(r.quantity))} <span style={{ fontWeight: 400, color: c.labelSecondary }}>{r.base_unit_name}</span>
      </span>
    ),
  },
  { key: 'details', label: 'Details', render: (r) => <span style={{ color: c.labelSecondary }}>{details(r)}</span> },
  { key: 'by', label: 'By', width: '130px', render: (r) => r.created_by_name || '—' },
];
