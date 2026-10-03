import React, { memo, useMemo } from 'react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import { Avatar, Card } from '../../../components/ui';
import { formatCount, formatCurrency } from '../../../utils/format';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';
import RankedBars from './RankedBars';
import ChartCard from './ChartCard';
import { sumBy } from './reportUtils';

export const CashierSummary = memo(function CashierSummary({ data }) {
  const top = data.rows[0];
  const items = [
    { label: 'Top Cashier', display: top ? top.full_name : '—', icon: appIcons.cashiers, footnote: top ? `${formatCurrency(top.total_revenue)} net sales` : 'No sales yet' },
    { label: 'Cashiers Active', display: formatCount(data.rows.length), icon: appIcons.customers, footnote: 'Made or had sales returned' },
    {
      label: 'Discounts Given',
      display: formatCurrency(data.totalDiscounts),
      icon: appIcons.receiptText,
      footnote: data.returnsTotal > 0 ? `${formatCurrency(data.returnsTotal)} returned` : 'Across all cashiers',
    },
  ];
  return <ReportSummaryCards items={items} />;
});

export const CashierRanking = memo(function CashierRanking({ rows }) {
  const items = useMemo(() => rows.map((r) => ({ label: r.full_name, value: r.total_revenue })), [rows]);
  return (
    <ChartCard title="Net sales per cashier">
      <RankedBars items={items} color="green" />
    </ChartCard>
  );
});

export const CashierTable = memo(function CashierTable({ columns, rows }) {
  const cols = useMemo(
    () =>
      columns.map((col) =>
        col.key === 'full_name'
          ? {
              ...col,
              render: (r) => (
                <span style={styles.name}>
                  <Avatar name={r.full_name} size={28} />
                  <span style={styles.nameText}>{r.full_name}</span>
                </span>
              ),
            }
          : col
      ),
    [columns]
  );
  const totals = useMemo(() => {
    const count = sumBy(rows, 'sales_count');
    return {
      sales_count: count,
      total_revenue: sumBy(rows, 'total_revenue'),
      returns_total: sumBy(rows, 'returns_total'),
      avg_sale_value: count > 0 ? sumBy(rows, 'gross_revenue') / count : 0,
      total_discounts: sumBy(rows, 'total_discounts'),
    };
  }, [rows]);
  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <ReportTable columns={cols} rows={rows} totals={totals} />
    </Card>
  );
});

const styles = {
  name: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 },
  nameText: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: theme.font.weightMedium },
};
