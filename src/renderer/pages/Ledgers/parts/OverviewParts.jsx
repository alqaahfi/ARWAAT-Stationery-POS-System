import React, { memo } from 'react';
import { ChevronRight, CircleCheck } from 'lucide-react';
import theme from '../../../config/theme';
import { Avatar, Button, Card, EmptyState, Icon, Skeleton } from '../../../components/ui';
import useInteraction from '../../../components/kit/useInteraction';
import BalanceChip from '../../../components/BalanceChip';

const c = theme.colors;

export const statGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: theme.spacing.md };
export const cardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))', gap: theme.spacing.md, alignItems: 'start' };

// "Customers who owe the most" / "Suppliers you owe the most".
export function TopPartiesCard({ title, party, rows, loading, emptyText, onOpen, footer }) {
  let body;
  if (loading) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, padding: theme.spacing.md }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height="20px" />
        ))}
      </div>
    );
  } else if (!rows?.length) {
    body = <EmptyState icon={CircleCheck} color="green" title={emptyText} style={{ padding: '28px 24px' }} />;
  } else {
    body = (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {rows.map((row, i) => (
          <li key={row.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${c.separator}` }}>
            <TopPartyRow row={row} party={party} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <h2 style={{ ...theme.type.headline, color: c.label, margin: 0, padding: `14px ${theme.spacing.md} 8px` }}>{title}</h2>
      {body}
      {footer && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `${theme.spacing.sm} ${theme.spacing.md}`, borderTop: `1px solid ${c.separator}`, backgroundColor: c.surfaceAlt }}>
          {footer}
        </div>
      )}
    </Card>
  );
}

const TopPartyRow = memo(function TopPartyRow({ row, party, onOpen }) {
  const { hovered, handlers } = useInteraction(false);
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      {...handlers}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.smd,
        width: '100%',
        minHeight: '52px',
        padding: `6px ${theme.spacing.md}`,
        border: 'none',
        backgroundColor: hovered ? c.surfaceAlt : 'transparent',
        fontFamily: theme.font.family,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <Avatar name={row.name} size={36} />
      <span style={{ flex: 1, minWidth: 0, ...theme.type.body, fontWeight: theme.font.weightMedium, color: c.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.name}
      </span>
      <BalanceChip amount={row.balance} party={party} />
      <Icon icon={ChevronRight} size={16} style={{ color: c.labelTertiary }} />
    </button>
  );
});

export function SeeOverdueButton({ onClick }) {
  return (
    <Button variant="plain" size="sm" onClick={onClick}>
      See overdue payments
    </Button>
  );
}
