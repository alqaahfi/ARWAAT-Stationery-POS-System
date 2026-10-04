import React from 'react';
import { AlertCircle, Banknote, PiggyBank, SlidersHorizontal } from 'lucide-react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { ledgerPage } from './parts/LedgerParts';
import { LedgerBackBar } from './parts/LedgerNav';
import { LedgerTile } from './LedgersHome';

const c = theme.colors;

const ITEMS = [
  { route: '/ledgers/payments', icon: Banknote, tone: 'green', title: glossary.payments, subtitle: 'Every payment received and made, with receipt reprints' },
  { route: '/ledgers/advances', icon: PiggyBank, tone: 'teal', title: glossary.paidInAdvance, subtitle: 'Customers and suppliers who are in credit' },
  { route: '/ledgers/aging', icon: AlertCircle, tone: 'orange', title: glossary.overduePayments, subtitle: 'Who has owed you the longest' },
  { route: '/ledgers/adjustments', icon: SlidersHorizontal, tone: 'purple', title: glossary.balanceCorrections, subtitle: 'Fix a balance with a written reason' },
];

// Wraps one of the four More pages with a breadcrumb back to More.
export function MoreSubPage({ route, onNavigate, children }) {
  const current = ITEMS.find((i) => i.route === route)?.title;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <LedgerBackBar
        crumbs={[
          { label: glossary.ledgers, onClick: () => onNavigate('/ledgers') },
          { label: 'More', onClick: () => onNavigate('/ledgers/more') },
        ]}
        current={current}
      />
      {children}
    </div>
  );
}

// Route: /ledgers/more. The secondary ledger pages, one tile each.
export default function LedgersMore({ onNavigate }) {
  return (
    <div style={{ ...ledgerPage, maxWidth: '1000px', margin: '0 auto', gap: theme.spacing.lg }}>
      <LedgerBackBar crumbs={[{ label: glossary.ledgers, onClick: () => onNavigate('/ledgers') }]} current="More" />
      <h1 style={{ ...theme.type.title1, color: c.label, margin: 0 }}>More</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: theme.spacing.md }}>
        {ITEMS.map((item) => (
          <LedgerTile key={item.route} size="small" icon={item.icon} tone={item.tone} title={item.title} subtitle={item.subtitle} onClick={() => onNavigate(item.route)} />
        ))}
      </div>
    </div>
  );
}
