import React, { memo } from 'react';
import { History } from 'lucide-react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Button, Card, EmptyState, Skeleton } from '../../components/ui';
import { formatCurrency, formatDateOnly } from '../../utils/format';
import { LoadError } from './PartyParts';

const c = theme.colors;
const TYPE_LABELS = { sale: 'Sale', payment: 'Payment', purchase: 'Purchase', adjustment: 'Correction', correction: 'Correction' };

function pretty(text) {
  const s = String(text || '').replace(/_/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function describe(row) {
  const kind = TYPE_LABELS[row.type] || pretty(row.type);
  const ref = row.type === 'payment' ? pretty(row.reference) : row.reference;
  return ref ? `${kind} · ${ref}` : kind;
}

// The newest five account entries from the existing ledger handler (which
// returns them oldest first), with a link to the full account page.
export function RecentActivityCard({ rows, loading, error, onRetry, onSeeAll }) {
  let body;
  if (loading) {
    body = (
      <div style={{ padding: theme.spacing.md, display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height="16px" />
        ))}
      </div>
    );
  } else if (error) {
    body = <LoadError message="Recent activity couldn't be loaded." onRetry={onRetry} />;
  } else if (!rows?.length) {
    body = <EmptyState icon={History} title="No activity yet" message="Sales, purchases and payments will show up here." style={{ padding: '28px 24px' }} />;
  } else {
    const recent = rows.slice(-5).reverse();
    body = (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {recent.map((row, i) => (
          <ActivityRow key={`${row.sortKey || row.date}-${i}`} row={row} first={i === 0} />
        ))}
      </ul>
    );
  }

  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <h2 style={{ ...theme.type.headline, color: c.label, margin: 0, padding: `14px ${theme.spacing.md} 6px` }}>Recent activity</h2>
      {body}
      {onSeeAll && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `${theme.spacing.sm} ${theme.spacing.md}`, borderTop: `1px solid ${c.separator}`, backgroundColor: c.surfaceAlt }}>
          <Button variant="plain" size="sm" onClick={onSeeAll}>
            {glossary.seeFullAccount}
          </Button>
        </div>
      )}
    </Card>
  );
}

const ActivityRow = memo(function ActivityRow({ row, first }) {
  const isPayment = row.type === 'payment';
  const amount = isPayment ? row.credit : row.debit || -row.credit;
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: '52px',
        padding: `8px ${theme.spacing.md}`,
        boxSizing: 'border-box',
        borderTop: first ? 'none' : `1px solid ${c.separator}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...theme.type.body, color: c.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{describe(row)}</div>
        <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>
          {formatDateOnly(row.date)}
          {row.note ? ` · ${row.note}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', ...theme.font.numeric, whiteSpace: 'nowrap' }}>
        <div style={{ ...theme.type.body, fontWeight: theme.font.weightMedium, color: isPayment ? c.greenText : c.label }}>
          {isPayment ? `− ${formatCurrency(amount)}` : formatCurrency(amount)}
        </div>
        {row.runningBalance !== undefined && row.runningBalance !== null && (
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>Balance {formatCurrency(row.runningBalance)}</div>
        )}
      </div>
    </li>
  );
});
