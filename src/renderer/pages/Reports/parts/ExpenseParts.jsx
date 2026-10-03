import React, { memo, useMemo } from 'react';
import { Repeat } from 'lucide-react';
import appIcons from '../../../config/appIcons';
import { Badge, Card, Icon } from '../../../components/ui';
import { formatCount, formatCurrency } from '../../../utils/format';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';
import RankedBars from './RankedBars';
import ChartCard from './ChartCard';
import { parseDay, sumBy } from './reportUtils';

// The server sends recurrence as its display label.
const ONE_TIME = 'One-time';

export const ExpenseSummary = memo(function ExpenseSummary({ data }) {
  const [total, count, largest] = data.summary.map((s) => s.value);
  const biggest = data.rows.find((r) => r.amount === largest);
  const items = [
    { label: 'Total Spent', display: formatCurrency(total), icon: appIcons.expenses, footnote: 'In this period' },
    { label: 'Number of Expenses', display: formatCount(count), icon: appIcons.receiptText, footnote: count === 1 ? '1 entry' : `${formatCount(count)} entries` },
    { label: 'Biggest Expense', display: count ? formatCurrency(largest) : '—', footnote: biggest ? biggest.payee !== '—' ? biggest.payee : biggest.description : 'Nothing spent' },
  ];
  return <ReportSummaryCards items={items} />;
});

export const ExpenseByType = memo(function ExpenseByType({ chartData }) {
  const items = useMemo(() => chartData.map((d) => ({ label: d.name, value: d.value })), [chartData]);
  return (
    <ChartCard title="Spending by how often it repeats">
      <RankedBars items={items} color="purple" />
    </ChartCard>
  );
});

export const ExpenseTable = memo(function ExpenseTable({ columns, rows }) {
  const cols = useMemo(
    () =>
      columns.map((col) => {
        if (col.key === 'recurrence')
          return {
            ...col,
            label: 'Repeats',
            render: (r) =>
              r.recurrence === ONE_TIME ? (
                <Badge tone="neutral">{r.recurrence}</Badge>
              ) : (
                <Badge tone="blue">
                  <Icon icon={Repeat} size={16} style={{ width: '12px', height: '12px' }} />
                  {r.recurrence}
                </Badge>
              ),
          };
        // A user-entered calendar date: show it as-is, no timezone shift.
        if (col.key === 'expense_date')
          return { ...col, render: (r) => parseDay(String(r.expense_date).slice(0, 10)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) };
        return col;
      }),
    [columns]
  );
  const totals = useMemo(() => ({ amount: sumBy(rows, 'amount') }), [rows]);
  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <ReportTable columns={cols} rows={rows} totals={totals} />
    </Card>
  );
});
