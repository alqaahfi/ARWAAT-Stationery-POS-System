import React, { memo, useMemo } from 'react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import { Avatar, Badge, Card } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { formatCount, formatCurrency } from '../../../utils/format';
import { priceLevelLabel } from '../../../utils/priceLevel';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';

const c = theme.colors;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

// Customer / Supplier statements share one layout. Server summary order:
// total, count with balance, highest single balance.
export const StatementSummary = memo(function StatementSummary({ data, party }) {
  const [total, count, highest] = data.summary.map((s) => s.value);
  const isCustomer = party === 'customer';
  const items = [
    {
      label: isCustomer ? 'Total Owed to You' : 'Total You Owe',
      display: formatCurrency(total),
      icon: isCustomer ? appIcons.receivePayment : appIcons.paySupplier,
      footnote: isCustomer ? 'Across these customers' : 'Across these suppliers',
    },
    {
      label: isCustomer ? 'Customers Who Owe' : 'Suppliers You Owe',
      display: formatCount(count),
      icon: isCustomer ? appIcons.customers : appIcons.suppliers,
      footnote: `Out of ${formatCount(data.rows.length)} shown`,
    },
    {
      label: 'Biggest Balance',
      display: highest > 0 ? formatCurrency(highest) : '—',
      footnote: data.highestBalanceName || (isCustomer ? 'Nobody owes you' : 'You owe nobody'),
    },
  ];
  return <ReportSummaryCards items={items} />;
});

function NameCell({ name }) {
  return (
    <span style={styles.name}>
      <Avatar name={name} size={28} />
      <span style={styles.nameText}>{name}</span>
    </span>
  );
}

export const StatementTable = memo(function StatementTable({ columns, rows, party, onRowClick }) {
  const cols = useMemo(
    () =>
      columns.map((col) => {
        if (col.key === 'name') return { ...col, render: (r) => <NameCell name={r.name} /> };
        if (col.key === 'customer_type') return { ...col, render: (r) => <Badge tone={r.customer_type === 'wholesale' ? 'purple' : 'blue'}>{cap(r.customer_type)}</Badge> };
        if (col.key === 'tier') return { ...col, label: 'Price Level', render: (r) => <span style={{ color: r.tier ? c.label : c.labelSecondary }}>{priceLevelLabel(r.tier)}</span> };
        if (col.key === 'balance_owed') return { ...col, render: (r) => <BalanceChip amount={r.balance_owed} party={party} /> };
        return col;
      }),
    [columns, party]
  );
  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <ReportTable columns={cols} rows={rows} onRowClick={onRowClick} />
    </Card>
  );
});

const styles = {
  name: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 },
  nameText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: theme.font.weightMedium },
};
