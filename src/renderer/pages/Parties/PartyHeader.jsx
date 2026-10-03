import React from 'react';
import theme from '../../config/theme';
import { Avatar, Card } from '../../components/ui';
import BalanceChip from '../../components/BalanceChip';

const c = theme.colors;

// Top of a customer / supplier profile: who they are on the left, what the
// balance is and what to do next on the right.
export function PartyHeader({ name, badges, contact, balance, party, actions }) {
  return (
    <Card padding={theme.spacing.mdl}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.md }}>
        <Avatar name={name} size={56} />
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <h2 style={{ ...theme.type.title1, color: c.label, margin: 0, overflowWrap: 'anywhere' }}>{name}</h2>
          {badges && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>{badges}</div>}
          {contact && <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '6px' }}>{contact}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.spacing.smd, marginLeft: 'auto' }}>
          <BalanceChip amount={balance} party={party} size="xl" />
          {actions && <div style={{ display: 'flex', gap: theme.spacing.sm }}>{actions}</div>}
        </div>
      </div>
    </Card>
  );
}

// "0300 1234567 · 0321 7654321 · Main Bazaar" — phone, mobile, address or any
// other parts, skipping whatever is empty.
export function contactLine(...parts) {
  return parts.filter((p) => p && String(p).trim()).join(' · ');
}
