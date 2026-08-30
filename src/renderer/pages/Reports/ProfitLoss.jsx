import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import theme from '../../config/theme';
import { Card, PageHeader } from '../../components/ui';
import DateRangePicker, { getDefaultRange } from './components/DateRangePicker';
import ReportSummaryCards from './components/ReportSummaryCards';
import ReportTable from './components/ReportTable';
import ExportButtons from './components/ExportButtons';

export default function ProfitLoss() {
  const [range, setRange] = useState(getDefaultRange());
  const [data, setData] = useState(null);

  const filters = { dateFrom: range.dateFrom, dateTo: range.dateTo };

  useEffect(() => {
    window.api.reports.getProfitLoss({ filters }).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.dateFrom, range.dateTo]);

  if (!data) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader
        title="Profit & Loss"
        actions={<ExportButtons rows={data.rows} columns={data.columns} reportType="profit-loss" filters={filters} suggestedName="profit-loss.csv" />}
      />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <DateRangePicker value={range} onChange={setRange} />
      </Card>

      <div style={styles.caveat}>
        Cost figures use current cost prices, not historical — for full accuracy, cost price should be snapshotted per sale in a
        future update.
      </div>

      <ReportSummaryCards items={data.summary} />

      <Card style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <h4 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Revenue vs Cost vs Expenses</h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
            <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: theme.colors.textSecondary }} />
            <YAxis tick={{ fontSize: 11, fill: theme.colors.textSecondary }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Revenue" fill={theme.colors.accentBlue} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Cost" fill={theme.colors.accentAmber} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill={theme.colors.accentPurple} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card style={{ padding: 0 }}>
        <ReportTable columns={data.columns} rows={data.rows} />
      </Card>
    </div>
  );
}

const styles = {
  caveat: {
    backgroundColor: theme.colors.warningBackground,
    color: theme.colors.warning,
    border: `1px solid ${theme.colors.warning}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: theme.font.sizeSm,
    marginBottom: theme.spacing.md,
  },
};
