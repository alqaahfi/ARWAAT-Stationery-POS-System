import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import theme from '../../config/theme';
import { Card, PageHeader } from '../../components/ui';
import DateRangePicker, { getDefaultRange } from './components/DateRangePicker';
import ReportSummaryCards from './components/ReportSummaryCards';
import ReportTable from './components/ReportTable';
import ExportButtons from './components/ExportButtons';

export default function CashierPerformance() {
  const [range, setRange] = useState(getDefaultRange());
  const [data, setData] = useState(null);

  const filters = { dateFrom: range.dateFrom, dateTo: range.dateTo };

  useEffect(() => {
    window.api.reports.getCashierPerformance({ filters }).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.dateFrom, range.dateTo]);

  if (!data) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader
        title="Cashier Performance"
        actions={
          <ExportButtons rows={data.rows} columns={data.columns} reportType="cashiers" filters={filters} suggestedName="cashier-performance.csv" />
        }
      />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <DateRangePicker value={range} onChange={setRange} />
      </Card>

      <ReportSummaryCards items={data.summary} />

      <Card style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <h4 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Revenue by Cashier</h4>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.colors.textSecondary }} />
            <YAxis tick={{ fontSize: 11, fill: theme.colors.textSecondary }} />
            <Tooltip />
            <Bar dataKey="revenue" fill={theme.colors.accentGreen} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card style={{ padding: 0 }}>
        <ReportTable columns={data.columns} rows={data.rows} />
      </Card>
    </div>
  );
}
