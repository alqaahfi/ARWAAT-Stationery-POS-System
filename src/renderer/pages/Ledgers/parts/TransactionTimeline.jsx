import React, { memo, useMemo, useState } from 'react';
import { History, Landmark, PackagePlus, Receipt, SlidersHorizontal, Trash2, Undo2, Wallet } from 'lucide-react';
import theme from '../../../config/theme';
import { Button, EmptyState, IconButton, IconTile } from '../../../components/ui';
import { formatCurrency, formatDateOnly } from '../../../utils/format';
import { methodLabel, monthLabel, parseDbDate } from './ledgerUtils';

const c = theme.colors;
const PAGE = 50;

const KINDS = {
  sale: { icon: Receipt, color: 'blue', title: (r) => (r.reference ? `Sale · ${r.reference}` : 'Sale') },
  purchase: { icon: PackagePlus, color: 'teal', title: (r) => (r.reference ? `Purchase · ${r.reference}` : 'Purchase') },
  payment: { icon: Wallet, color: 'green', title: (r) => `${r.label || 'Payment'} · ${methodLabel(r.reference)}` },
  adjustment: { icon: SlidersHorizontal, color: 'gray', title: (r) => r.label || 'Correction' },
  opening: { icon: Landmark, color: 'gray', title: () => 'Starting balance' },
  return: { icon: Undo2, color: 'gray', title: (r) => (r.reference ? `Return · ${r.reference}` : 'Return') },
};

// "Goods Rs 500 · cash back Rs 200" — cash part left out when none was given.
export function returnNote(row) {
  const cash = Number(row.cash_refund_amount) || 0;
  return `Goods ${formatCurrency(row.total_amount)}${cash > 0 ? ` · cash back ${formatCurrency(cash)}` : ''}`;
}

function runningText(value) {
  if (value === undefined || value === null) return null;
  return value < 0 ? `Balance ${formatCurrency(-value)} in advance` : `Balance ${formatCurrency(value)}`;
}

// The ledger handler's rows (oldest first), shown newest first and grouped by
// month. Only 50 rows go into the page at a time to keep old PCs quick.
export default function TransactionTimeline({ rows, openingBalance, openingDate, onDeletePayment }) {
  const [shown, setShown] = useState(PAGE);

  const all = useMemo(() => {
    const list = [...(rows || [])].reverse();
    const opening = Number(openingBalance) || 0;
    if (Math.abs(opening) >= 0.005) {
      list.push({
        type: 'opening',
        date: openingDate,
        debit: opening > 0 ? opening : 0,
        credit: opening < 0 ? -opening : 0,
        runningBalance: opening,
      });
    }
    return list;
  }, [rows, openingBalance, openingDate]);

  const groups = useMemo(() => {
    const out = [];
    for (const row of all.slice(0, shown)) {
      const label = parseDbDate(row.date) ? monthLabel(row.date) : 'Earlier';
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(row);
      else out.push({ label, rows: [row] });
    }
    return out;
  }, [all, shown]);

  if (!all.length) {
    return <EmptyState icon={History} title="No transactions yet" message="Sales, purchases, payments and corrections will show up here." />;
  }

  return (
    <div>
      {groups.map((group, gi) => (
        <section key={`${group.label}-${gi}`}>
          <h3
            style={{
              ...theme.type.footnote,
              fontWeight: theme.font.weightSemibold,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: c.labelSecondary,
              margin: 0,
              padding: `${theme.spacing.smd} ${theme.spacing.md} 6px`,
              backgroundColor: c.surfaceAlt,
              borderTop: gi === 0 ? 'none' : `1px solid ${c.separator}`,
              borderBottom: `1px solid ${c.separator}`,
            }}
          >
            {group.label}
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {group.rows.map((row, i) => (
              <TimelineRow key={row.sortKey || `${row.type}-${row.date}-${i}`} row={row} first={i === 0} onDeletePayment={onDeletePayment} />
            ))}
          </ul>
        </section>
      ))}
      {all.length > shown && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: theme.spacing.smd, borderTop: `1px solid ${c.separator}` }}>
          <Button variant="plain" onClick={() => setShown((n) => n + PAGE)}>
            Show older transactions
          </Button>
        </div>
      )}
    </div>
  );
}

const TimelineRow = memo(function TimelineRow({ row, first, onDeletePayment }) {
  const kind = KINDS[row.type] || { icon: History, color: 'gray', title: (r) => r.type || 'Entry' };
  const reduces = (Number(row.credit) || 0) > 0;
  const amount = reduces ? Number(row.credit) : Number(row.debit) || 0;
  const note = row.type === 'adjustment' ? row.reason || row.note : row.type === 'return' ? returnNote(row) : row.note;
  const noEffect = row.type === 'return' && !reduces;
  const balance = runningText(row.runningBalance);

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.smd,
        minHeight: '56px',
        padding: `8px ${theme.spacing.md}`,
        boxSizing: 'border-box',
        borderTop: first ? 'none' : `1px solid ${c.separator}`,
      }}
    >
      <IconTile icon={kind.icon} color={kind.color} variant="soft" size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...theme.type.body, fontWeight: theme.font.weightMedium, color: c.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {kind.title(row)}
        </div>
        <div style={{ ...theme.type.footnote, color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {formatDateOnly(row.date)}
          {note ? ` · ${note}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', ...theme.font.numeric, whiteSpace: 'nowrap' }}>
        <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: reduces ? c.greenText : c.label }}>
          {noEffect ? '—' : reduces ? `−${formatCurrency(amount)}` : formatCurrency(amount)}
        </div>
        {balance && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{balance}</div>}
      </div>
      {onDeletePayment && row.type === 'payment' && row.paymentId && (
        <IconButton icon={Trash2} tone="danger" size="sm" label="Delete this payment" onClick={() => onDeletePayment(row)} />
      )}
    </li>
  );
});
