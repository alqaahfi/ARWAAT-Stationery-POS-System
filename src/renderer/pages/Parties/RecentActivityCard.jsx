import React, { memo } from 'react';
import { History, Trash2 } from 'lucide-react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Button, Card, EmptyState, IconButton, Skeleton } from '../../components/ui';
import { formatCurrency, formatDateOnly } from '../../utils/format';
import { LoadError } from './PartyParts';
import { returnNote } from '../Ledgers/parts/TransactionTimeline';

const c = theme.colors;
const TYPE_LABELS = { sale: 'Sale', payment: 'Payment', purchase: 'Purchase', adjustment: 'Correction', correction: 'Correction', return: 'Return' };

function pretty(text) {
  const s = String(text || '').replace(/_/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function describe(row) {
  const kind = row.label || TYPE_LABELS[row.type] || pretty(row.type);
  const ref = row.type === 'payment' ? pretty(row.reference) : row.reference;
  return ref ? `${kind} · ${ref}` : kind;
}

// The newest five account entries from the existing ledger handler (which
// returns them oldest first), with a link to the full account page.
export function RecentActivityCard({ rows, loading, error, onRetry, onSeeAll, onDeletePayment }) {
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
          <ActivityRow key={`${row.sortKey || row.date}-${i}`} row={row} first={i === 0} onDeletePayment={onDeletePayment} />
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

// Mirrors the account timeline: a correction shows its sign — an increase as
// "+amount", a reduction as "−amount" in green — with the reason underneath.
function amountText(row) {
  if (row.type === 'adjustment') {
    const reduces = (Number(row.credit) || 0) > 0;
    return reduces
      ? { text: `−${formatCurrency(row.credit)}`, color: c.greenText }
      : { text: `+${formatCurrency(row.debit)}`, color: c.label };
  }
  if (row.type === 'payment') return { text: `− ${formatCurrency(row.credit)}`, color: c.greenText };
  if (row.type === 'return') {
    return (Number(row.credit) || 0) > 0 ? { text: `−${formatCurrency(row.credit)}`, color: c.greenText } : { text: '—', color: c.labelSecondary };
  }
  return { text: formatCurrency(row.debit || -row.credit), color: c.label };
}

const ActivityRow = memo(function ActivityRow({ row, first, onDeletePayment }) {
  const amount = amountText(row);
  const note = row.type === 'adjustment' ? row.reason || row.note : row.type === 'return' ? returnNote(row) : row.note;
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
          {note ? ` · ${note}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', ...theme.font.numeric, whiteSpace: 'nowrap' }}>
        <div style={{ ...theme.type.body, fontWeight: theme.font.weightMedium, color: amount.color }}>{amount.text}</div>
        {row.runningBalance !== undefined && row.runningBalance !== null && (
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>Balance {formatCurrency(row.runningBalance)}</div>
        )}
      </div>
      {onDeletePayment && row.type === 'payment' && row.paymentId && (
        <IconButton icon={Trash2} tone="danger" size="sm" label="Delete this payment" onClick={() => onDeletePayment(row)} />
      )}
    </li>
  );
});
