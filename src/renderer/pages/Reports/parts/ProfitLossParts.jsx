import React, { memo, useMemo } from 'react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import { Card } from '../../../components/ui';
import { formatCurrency, formatCurrencyExact } from '../../../utils/format';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';
import ReportBarChart from './ReportBarChart';
import ChartCard from './ChartCard';
import { bucketLabel } from './reportUtils';

const UNIT_WORD = { day: 'day', week: 'week', month: 'month' };

export const ProfitSummary = memo(function ProfitSummary({ data }) {
  const t = data.totals;
  const items = [
    {
      label: 'Net Sales',
      display: formatCurrency(t.revenue),
      icon: appIcons.sell,
      footnote: data.returnsTotal > 0 ? `${formatCurrency(data.returnsTotal)} returned` : 'After any returns',
    },
    { label: 'Cost of Goods', display: formatCurrency(t.cogs), icon: appIcons.products, footnote: 'What the items sold cost you' },
    { label: 'Expenses', display: formatCurrency(t.expenses), icon: appIcons.expenses, footnote: 'Rent, bills and other spending' },
    {
      label: 'Profit',
      display: formatCurrency(t.netProfit),
      icon: appIcons.reports,
      valueColor: t.netProfit >= 0 ? 'greenText' : 'redText',
      footnote: t.netProfit >= 0 ? 'You made money' : 'You lost money',
    },
  ];
  return <ReportSummaryCards items={items} />;
});

const SERIES = [
  { key: 'Revenue', label: 'Net sales', color: 'accent' },
  { key: 'Cost', label: 'Cost of goods', color: 'orange' },
  { key: 'Expenses', label: 'Expenses', color: 'purple' },
];

export const ProfitChart = memo(function ProfitChart({ rows, unit }) {
  const format = useMemo(() => (key) => bucketLabel(key, unit), [unit]);
  const ariaLabel = useMemo(() => {
    const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
    return `Net sales, cost of goods and expenses per ${UNIT_WORD[unit] || 'period'} for ${rows.length} periods: net sales ${formatCurrencyExact(sum('Revenue'))}, cost of goods ${formatCurrencyExact(sum('Cost'))}, expenses ${formatCurrencyExact(sum('Expenses'))}.`;
  }, [rows, unit]);
  return (
    <ChartCard title={`Sales, cost and expenses per ${UNIT_WORD[unit] || 'period'}`}>
      <ReportBarChart data={rows} xKey="bucket" series={SERIES} formatX={format} ariaLabel={ariaLabel} height={260} />
    </ChartCard>
  );
});

export const ProfitTable = memo(function ProfitTable({ columns, rows, totals, unit }) {
  const cols = useMemo(
    () =>
      columns.map((col) => {
        if (col.key === 'bucket') return { ...col, render: (r) => bucketLabel(r.bucket, unit) };
        if (col.key === 'netProfit')
          return { ...col, render: (r) => <span style={{ color: r.netProfit < 0 ? theme.colors.redText : undefined }}>{formatCurrencyExact(r.netProfit)}</span> };
        return col;
      }),
    [columns, unit]
  );
  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <ReportTable columns={cols} rows={rows} totals={totals} />
    </Card>
  );
});
