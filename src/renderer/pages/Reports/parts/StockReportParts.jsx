import React, { memo, useMemo } from 'react';
import appIcons from '../../../config/appIcons';
import glossary from '../../../config/glossary';
import { Badge, Card } from '../../../components/ui';
import { formatCount, formatCurrency } from '../../../utils/format';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';
import RankedBars from './RankedBars';
import ChartCard from './ChartCard';
import { sumBy } from './reportUtils';

// Server summary order (Product.js numbers): value, products, low, dead.
export const StockSummary = memo(function StockSummary({ summary }) {
  const [value, products, low, dead] = summary.map((s) => s.value);
  const items = [
    { label: 'Stock Value', display: formatCurrency(value), icon: appIcons.products, footnote: 'At buying prices' },
    { label: 'Products', display: formatCount(products), icon: appIcons.categories, footnote: 'Active products' },
    { label: glossary.runningLow, display: formatCount(low), icon: appIcons.runningLow, valueColor: low ? 'orangeText' : undefined, footnote: low ? 'Items to reorder' : 'All stocked up' },
    { label: glossary.notSelling, display: formatCount(dead), icon: appIcons.notSelling, footnote: 'No sales for a while' },
  ];
  return <ReportSummaryCards items={items} />;
});

export const StockByCategory = memo(function StockByCategory({ chartData }) {
  const items = useMemo(() => chartData.map((d) => ({ label: d.name, value: d.valuation })), [chartData]);
  return (
    <ChartCard title="Stock value by category">
      <RankedBars items={items} color="accent" />
    </ChartCard>
  );
});

function StatusBadge({ row }) {
  if (Number(row.total_stock) <= 0) return <Badge tone="red">Out of stock</Badge>;
  if (row.status === 'Low') return <Badge tone="orange">{glossary.runningLow}</Badge>;
  if (row.status === 'Dead') return <Badge tone="neutral">{glossary.notSelling}</Badge>;
  return <Badge tone="green">In stock</Badge>;
}

export const StockTable = memo(function StockTable({ columns, rows }) {
  const cols = useMemo(() => columns.map((col) => (col.key === 'status' ? { ...col, render: (r) => <StatusBadge row={r} /> } : col)), [columns]);
  const totals = useMemo(() => ({ total_stock: sumBy(rows, 'total_stock'), valuation: sumBy(rows, 'valuation') }), [rows]);
  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <ReportTable columns={cols} rows={rows} totals={totals} emptyText="No products found." />
    </Card>
  );
});
