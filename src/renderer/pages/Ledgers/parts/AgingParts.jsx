import React from 'react';
import theme from '../../../config/theme';
import { Card, Skeleton } from '../../../components/ui';
import { formatCurrency, formatDateOnly } from '../../../utils/format';
import { PartyCell } from './LedgerParts';

const c = theme.colors;

// Overdue color language: 0–30 plain · 31–60 orange · 61–90 orange on tint ·
// 90+ red on tint.
export const BUCKETS = [
  { key: 'b0_30', label: '0–30 days', tone: { color: c.label } },
  { key: 'b31_60', label: '31–60 days', tone: { color: c.orangeText } },
  { key: 'b61_90', label: '61–90 days', tone: { color: c.orangeText, backgroundColor: c.orangeTint } },
  { key: 'b90plus', label: '90+ days', tone: { color: c.redText, backgroundColor: c.redTint } },
];

export function BucketCards({ totals, loading }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: theme.spacing.md }}>
      {BUCKETS.map((b) => {
        const value = totals[b.key] || 0;
        const tinted = value > 0 && b.tone.backgroundColor;
        return (
          <Card key={b.key} style={{ backgroundColor: tinted || c.surface }}>
            <div style={{ ...theme.type.subhead, color: value > 0 && b.key !== 'b0_30' ? b.tone.color : c.labelSecondary }}>{b.label}</div>
            {loading ? (
              <Skeleton width="60%" height="26px" style={{ marginTop: '8px' }} />
            ) : (
              <div
                style={{
                  ...theme.type.title1,
                  ...theme.font.numeric,
                  marginTop: '6px',
                  color: value > 0 ? b.tone.color : c.labelTertiary,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatCurrency(value)}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function BucketCell({ value, tone }) {
  if (!value) return <span style={{ color: c.labelTertiary }}>—</span>;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: tone.backgroundColor ? '2px 8px' : 0,
        borderRadius: theme.radius.xs,
        fontWeight: theme.font.weightMedium,
        ...tone,
      }}
    >
      {formatCurrency(value)}
    </span>
  );
}

export const agingColumns = [
  { key: 'customer', label: 'Customer', render: (r) => <PartyCell name={r.customerName} /> },
  {
    key: 'total',
    label: 'Total owed',
    numeric: true,
    render: (r) => <span style={{ fontWeight: theme.font.weightSemibold }}>{formatCurrency(r.totalOwed)}</span>,
  },
  ...BUCKETS.map((b) => ({ key: b.key, label: b.label, numeric: true, render: (r) => <BucketCell value={r[b.key]} tone={b.tone} /> })),
  { key: 'oldest', label: 'Oldest unpaid sale', render: (r) => formatDateOnly(r.oldestUnpaidDate) },
];
