import React from 'react';
import { ChevronRight, MoreHorizontal, Truck, Users } from 'lucide-react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import useInteraction from '../../components/kit/useInteraction';
import { ledgerPage } from './parts/LedgerParts';

const c = theme.colors;

// A clickable tile. size 'large' is the prominent Customers / Suppliers card,
// 'small' the quieter More card. tone picks a theme colour family.
export function LedgerTile({ icon: Icon, title, subtitle, tone, size = 'large', onClick }) {
  const { hovered, pressed, handlers } = useInteraction(false);
  const large = size === 'large';
  const iconBox = large ? '72px' : '40px';

  return (
    <button
      type="button"
      onClick={onClick}
      {...handlers}
      style={{
        display: 'flex',
        flexDirection: large ? 'column' : 'row',
        alignItems: large ? 'flex-start' : 'center',
        justifyContent: large ? 'space-between' : 'flex-start',
        gap: large ? theme.spacing.lg : theme.spacing.md,
        minHeight: large ? '240px' : 'auto',
        padding: large ? theme.spacing.xl : theme.spacing.md,
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: 'pointer',
        backgroundColor: c.surface,
        border: `1px solid ${hovered ? c[tone] : c.separator}`,
        borderRadius: theme.radius.xl,
        boxShadow: hovered ? theme.shadow.popover : theme.shadow.card,
        transform: pressed ? 'scale(0.99)' : hovered ? 'translateY(-3px)' : 'none',
        transition: `transform ${theme.motion.base} ${theme.motion.easing}, box-shadow ${theme.motion.base} ease, border-color ${theme.motion.base} ease`,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: iconBox,
          height: iconBox,
          flexShrink: 0,
          borderRadius: large ? theme.radius.xl : theme.radius.md,
          backgroundColor: hovered ? c[tone] : c[`${tone}Tint`],
          color: hovered ? c.labelOnAccent : c[tone],
          transition: `background-color ${theme.motion.base} ease, color ${theme.motion.base} ease`,
        }}
      >
        <Icon size={large ? 36 : 20} aria-hidden="true" />
      </span>

      <span style={{ display: 'block', flex: large ? 'none' : 1, minWidth: 0 }}>
        <span style={{ display: 'block', ...(large ? theme.type.largeTitle : theme.type.headline), color: c.label }}>{title}</span>
        <span style={{ display: 'block', ...(large ? theme.type.body : theme.type.footnote), color: c.labelSecondary, marginTop: theme.spacing.xs }}>{subtitle}</span>
      </span>

      <ChevronRight
        size={large ? 24 : 18}
        color={hovered ? c[tone] : c.labelTertiary}
        aria-hidden="true"
        style={{
          alignSelf: large ? 'flex-end' : 'center',
          flexShrink: 0,
          transform: hovered ? 'translateX(4px)' : 'none',
          transition: `transform ${theme.motion.base} ${theme.motion.easing}`,
        }}
      />
    </button>
  );
}

// Route: /ledgers. The Ledgers front door — two big doors (Customers,
// Suppliers) and a small one (More) for the secondary ledger pages.
export default function LedgersHome({ onNavigate }) {
  return (
    <div style={{ ...ledgerPage, maxWidth: '1000px', margin: '0 auto', gap: theme.spacing.lg, paddingTop: theme.spacing.md }}>
      <div>
        <h1 style={{ ...theme.type.title1, color: c.label, margin: 0 }}>{glossary.ledgers}</h1>
        <p style={{ ...theme.type.body, color: c.labelSecondary, margin: `${theme.spacing.xs} 0 0` }}>Who owes you, and who you owe. Pick where to start.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: theme.spacing.lg }}>
        <LedgerTile
          icon={Users}
          tone="blue"
          title={glossary.customers}
          subtitle="Balances and transactions for the people you sell to"
          onClick={() => onNavigate('/ledgers/customers')}
        />
        <LedgerTile
          icon={Truck}
          tone="indigo"
          title={glossary.suppliers}
          subtitle="Balances and transactions for the people you buy from"
          onClick={() => onNavigate('/ledgers/suppliers')}
        />
      </div>

      <div style={{ maxWidth: '360px' }}>
        <LedgerTile
          size="small"
          icon={MoreHorizontal}
          tone="gray"
          title="More"
          subtitle="Payments, advances, overdue and corrections"
          onClick={() => onNavigate('/ledgers/more')}
        />
      </div>
    </div>
  );
}
