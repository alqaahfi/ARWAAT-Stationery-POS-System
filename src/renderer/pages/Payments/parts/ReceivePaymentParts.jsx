import React from 'react';
import { CircleCheck, Lock } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Avatar, Badge, Button, Card, EmptyState, IconTile, Kbd } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { formatCurrency } from '../../../utils/format';

const c = theme.colors;

// Receive Payment layout: one centered column.
export const column = {
  width: '100%',
  maxWidth: '640px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing.md,
  paddingBottom: theme.spacing.xxl,
};

export function Intro() {
  return <p style={{ ...theme.type.subhead, color: c.labelSecondary, margin: 0 }}>Record money a customer pays toward what they owe.</p>;
}

export function TypeBadge({ type }) {
  if (!type) return null;
  return <Badge tone={type === 'wholesale' ? 'purple' : 'blue'}>{type === 'wholesale' ? 'Wholesale' : 'Retail'}</Badge>;
}

// Who is paying. Only shows what the minimal customer search returns.
export function SelectedCustomerCard({ customer, onChange, disabled }) {
  const hasBalance = customer.balance_owed !== undefined && customer.balance_owed !== null;
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
        <Avatar name={customer.name} size={56} />
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <h2 style={{ ...theme.type.title2, color: c.label, margin: 0 }}>{customer.name}</h2>
            <TypeBadge type={customer.customer_type} />
          </div>
          {customer.phone && <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' }}>{customer.phone}</div>}
          <Button variant="plain" size="sm" onClick={onChange} disabled={disabled} style={{ marginLeft: '-10px', marginTop: '4px' }}>
            Change
          </Button>
        </div>
        {hasBalance && <BalanceChip amount={customer.balance_owed} size="xl" />}
      </div>
    </Card>
  );
}

// Replaces the form once the payment is saved.
export function PaymentSuccess({ name, amount, newBalance, estimated, onNext }) {
  const hasBalance = newBalance !== undefined && newBalance !== null && !Number.isNaN(Number(newBalance));
  return (
    <Card>
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: `${theme.spacing.lg} 0` }}>
        <IconTile icon={CircleCheck} color="green" variant="soft" size="lg" />
        <h2 style={{ ...theme.type.title2, color: c.label, margin: `${theme.spacing.smd} 0 0` }}>Payment recorded</h2>
        <div style={{ ...theme.type.body, color: c.labelSecondary, marginTop: '4px' }}>
          {name} — <span style={{ ...theme.font.numeric, color: c.label, fontWeight: theme.font.weightSemibold }}>{formatCurrency(amount)}</span> received
        </div>
        {hasBalance && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: theme.spacing.smd }}>
            <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>{estimated ? 'Now about:' : 'Now:'}</span>
            <BalanceChip amount={newBalance} />
          </div>
        )}
        <Button size="lg" onClick={onNext} autoFocus style={{ marginTop: theme.spacing.lg, minWidth: '200px' }}>
          {glossary.nextCustomer}
        </Button>
        <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: theme.spacing.sm }}>
          Press <Kbd>Enter</Kbd> for the next customer
        </div>
      </div>
    </Card>
  );
}

export function NoAccess() {
  return (
    <Card padding="0" style={{ maxWidth: '560px', margin: '0 auto' }}>
      <EmptyState
        icon={Lock}
        title="You can't receive payments yet"
        message={'Ask your admin to turn on "Record Payment" for your account.'}
        style={{ padding: '48px 24px' }}
      />
    </Card>
  );
}
