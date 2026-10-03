import React, { memo, useMemo } from 'react';
import { X } from 'lucide-react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import { Badge, Button, Card } from '../../../components/ui';
import { formatCount, formatCurrency, formatCurrencyExact } from '../../../utils/format';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';
import ReportBarChart from './ReportBarChart';
import ChartCard from './ChartCard';
import { longDay, shortDay, sumBy } from './reportUtils';

const c = theme.colors;

const PAYMENT_TONE = { paid: 'green', partial: 'orange', unpaid: 'red' };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

export const SalesSummary = memo(function SalesSummary({ data }) {
  const items = [
    {
      label: 'Net Sales',
      display: formatCurrency(data.netRevenue),
      icon: appIcons.sell,
      footnote: `Retail ${formatCurrency(data.retailTotal)} · Wholesale ${formatCurrency(data.wholesaleTotal)}`,
    },
    { label: 'Sales', display: formatCount(data.salesCount), icon: appIcons.sales, footnote: data.salesCount === 1 ? '1 sale made' : `${formatCount(data.salesCount)} sales made` },
    { label: 'Average Sale', display: formatCurrency(data.avgSaleValue), footnote: 'Per sale, before returns' },
  ];
  if (data.returnsTotal > 0) {
    items.push({
      label: 'Returns',
      display: formatCurrency(data.returnsTotal),
      icon: appIcons.returns,
      valueColor: 'redText',
      footnote: `Before returns: ${formatCurrency(data.grossRevenue)}`,
    });
  }
  return <ReportSummaryCards items={items} />;
});

const SERIES = [{ key: 'revenue', label: 'Net sales', color: 'accent' }];

export const SalesChart = memo(function SalesChart({ data, selectedDay, onDayClick }) {
  const ariaLabel = useMemo(() => {
    const best = data.reduce((m, d) => (d.revenue > (m?.revenue ?? -Infinity) ? d : m), null);
    return `Net sales per day for ${data.length} days, total ${formatCurrencyExact(sumBy(data, 'revenue'))}${best ? `. Best day ${longDay(best.date)} with ${formatCurrencyExact(best.revenue)}` : ''}.`;
  }, [data]);
  return (
    <ChartCard title="Net sales per day" right="Click a bar to show only that day">
      <ReportBarChart
        data={data}
        xKey="date"
        series={SERIES}
        formatX={shortDay}
        formatTooltipX={longDay}
        onBarClick={onDayClick}
        selectedX={selectedDay}
        hint="Click to show only this day"
        ariaLabel={ariaLabel}
      />
    </ChartCard>
  );
});

export const SalesTable = memo(function SalesTable({ columns, rows, selectedDay, onClearDay }) {
  const cols = useMemo(
    () =>
      columns.map((col) => {
        if (col.key === 'payment_status') return { ...col, render: (r) => <Badge tone={PAYMENT_TONE[r.payment_status]}>{cap(r.payment_status)}</Badge> };
        if (col.key === 'sale_type') return { ...col, render: (r) => cap(r.sale_type) };
        if (col.key === 'invoice_no') return { ...col, render: (r) => <span style={{ ...theme.font.numeric, fontWeight: theme.font.weightMedium }}>{r.invoice_no}</span> };
        return col;
      }),
    [columns]
  );
  const totals = useMemo(() => ({ total_amount: sumBy(rows, 'total_amount') }), [rows]);

  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      {selectedDay && (
        <div style={styles.dayBar}>
          <span>
            Showing only <strong>{longDay(selectedDay)}</strong> · {formatCount(rows.length)} {rows.length === 1 ? 'sale' : 'sales'}
          </span>
          <Button variant="plain" size="sm" icon={X} onClick={onClearDay}>
            Show all days
          </Button>
        </div>
      )}
      <ReportTable columns={cols} rows={rows} totals={totals} />
    </Card>
  );
});

const styles = {
  dayBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: '6px 8px 6px 14px',
    backgroundColor: c.accentTint,
    color: c.label,
    ...theme.type.subhead,
    borderBottom: `1px solid ${c.separator}`,
  },
};
