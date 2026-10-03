import React, { useId } from 'react';
import { BadgePercent, ChartColumn, HandCoins, KeyRound, Package, Receipt, ShoppingCart, ShieldCheck, UserCheck, UserX, Wallet } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Avatar, Badge, Button, Card, Field, ListRow, NumberInput, PasswordInput, Skeleton, TextInput, Toggle } from '../../../components/ui';
import { SectionCard } from '../../Products/form/fields';

const c = theme.colors;

// Plain-words copy and an icon per permission key. Keys, types and order
// always come from permissionDefinitions.js (via IPC) — this only rewords
// them. A key missing here falls back to the catalog's own label/description.
const PERMISSION_COPY = {
  make_sale: { icon: ShoppingCart, color: 'green', title: 'Make sales', subtitle: 'Let this cashier ring up sales on the New Sale screen.' },
  view_products: { icon: Package, color: 'orange', title: 'See products and stock', subtitle: 'Let them look through the product list and what is running low.' },
  record_payment: { icon: HandCoins, color: 'green', title: 'Receive payments', subtitle: 'Let them take money from customers paying off what they owe.' },
  max_discount_percentage: {
    icon: BadgePercent,
    color: 'orange',
    title: glossary.maxDiscount,
    subtitle: 'The biggest discount they can give on a sale. Leave empty to use the shop default.',
  },
  view_sales_history: { icon: Receipt, color: 'teal', title: 'See past sales', subtitle: 'Let them look up the sales they have made before.' },
  view_reports: { icon: ChartColumn, color: 'indigo', title: 'See their sales report', subtitle: 'Let them see the sales report for their own sales.' },
  manage_expenses: { icon: Wallet, color: 'pink', title: 'Record expenses', subtitle: 'Let them add and look at shop expenses.' },
};

export function permissionCopy(def) {
  const copy = PERMISSION_COPY[def.key] || {};
  return {
    icon: copy.icon || ShieldCheck,
    color: copy.color || 'gray',
    title: copy.title || def.label,
    subtitle: copy.subtitle || def.description,
  };
}

// Count of switched-on permissions plus one plain line each (for a tooltip).
export function permissionSummary(definitions, values) {
  const lines = [];
  for (const def of definitions) {
    const v = values[def.key];
    if (def.type === 'boolean') {
      if (v) lines.push(permissionCopy(def).title);
    } else if (v !== '' && v != null) {
      lines.push(`${permissionCopy(def).title}: ${v}%`);
    }
  }
  return { count: lines.length, lines };
}

export function StatusBadge({ active }) {
  return active ? (
    <Badge tone="green" dot>
      Active
    </Badge>
  ) : (
    <Badge dot>Inactive</Badge>
  );
}

export function CashierHeader({ name, username, isActive, onResetPassword, onToggleActive, togglingActive }) {
  return (
    <Card padding={theme.spacing.mdl}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.md }}>
        <Avatar name={name} size={56} />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm }}>
            <h2 style={{ ...theme.type.title2, color: c.label, margin: 0, overflowWrap: 'anywhere' }}>{name}</h2>
            <StatusBadge active={isActive} />
          </div>
          <div style={{ ...theme.type.footnote, fontFamily: theme.font.mono, color: c.labelSecondary, marginTop: '4px' }}>{username}</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm, marginLeft: 'auto' }}>
          <Button variant="secondary" icon={KeyRound} onClick={onResetPassword}>
            {glossary.resetPassword}
          </Button>
          {isActive ? (
            <Button variant="danger" icon={UserX} onClick={onToggleActive} loading={togglingActive}>
              Deactivate
            </Button>
          ) : (
            <Button variant="tinted" icon={UserCheck} onClick={onToggleActive} loading={togglingActive}>
              Reactivate
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Name / username / password. In edit mode only the name can change; the
// username is shown read-only and passwords go through Reset Password.
export function AccountCard({ isEdit, values, errors, onChange, onUsernameBlur }) {
  return (
    <SectionCard title="Account">
      <Field label="Full name" required error={errors.fullName}>
        <TextInput id="cashier-full-name" value={values.fullName} onChange={(e) => onChange('fullName', e.target.value)} autoFocus={!isEdit} autoComplete="off" />
      </Field>
      <Field label="Username" required={!isEdit} error={errors.username} hint={isEdit ? 'Usernames can’t be changed after the account is made.' : 'What they type to log in.'}>
        <TextInput
          id="cashier-username"
          value={values.username}
          disabled={isEdit}
          onChange={(e) => onChange('username', e.target.value)}
          onBlur={onUsernameBlur}
          autoComplete="off"
          style={{ fontFamily: theme.font.mono }}
        />
      </Field>
      {!isEdit && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', columnGap: theme.spacing.md }}>
          <Field label="Password" required error={errors.password} hint="At least 6 characters." style={{ marginBottom: 0 }}>
            <PasswordInput id="cashier-password" value={values.password} onChange={(e) => onChange('password', e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" required error={errors.confirmPassword} style={{ marginBottom: 0 }}>
            <PasswordInput
              id="cashier-confirm-password"
              value={values.confirmPassword}
              onChange={(e) => onChange('confirmPassword', e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
      )}
    </SectionCard>
  );
}

function DiscountInput({ id, value, onChange, label }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <NumberInput
        id={id}
        aria-label={label}
        value={value ?? ''}
        placeholder="Shop default"
        onChange={(e) => {
          const next = e.target.value;
          if (/^\d*\.?\d*$/.test(next)) onChange(next);
        }}
        style={{ width: '120px' }}
      />
      <span style={{ ...theme.type.body, color: c.labelSecondary }}>%</span>
    </div>
  );
}

function PermissionRow({ def, value, onChange, separator }) {
  const id = useId();
  const copy = permissionCopy(def);
  const title = (
    <label htmlFor={id} style={{ cursor: 'pointer' }}>
      {copy.title}
    </label>
  );
  const trailing =
    def.type === 'boolean' ? (
      <Toggle id={id} checked={!!value} onChange={(v) => onChange(def.key, v)} label={copy.title} />
    ) : (
      <DiscountInput id={id} value={value} onChange={(v) => onChange(def.key, v)} label={copy.title} />
    );
  return <ListRow icon={copy.icon} color={copy.color} title={title} subtitle={copy.subtitle} trailing={trailing} separator={separator} />;
}

// Every catalog entry, in catalog order: switches for yes/no permissions, a
// small % box for the discount cap.
export function PermissionsCard({ definitions, values, onChange, loading }) {
  return (
    <SectionCard title={glossary.cashierPermissions} intro="Turn on what this cashier is allowed to do.">
      {loading ? (
        <Skeleton lines={4} height="18px" />
      ) : (
        <div style={{ border: `1px solid ${c.separator}`, borderRadius: theme.radius.md, overflow: 'hidden' }}>
          {definitions.map((def, i) => (
            <PermissionRow key={def.key} def={def} value={values[def.key]} onChange={onChange} separator={i > 0} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
