import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import theme from '../../config/theme';
import { Card, PageHeader, Label, Select } from '../../components/ui';
import DateRangePicker, { getDefaultRange } from './components/DateRangePicker';
import ReportSummaryCards from './components/ReportSummaryCards';
import ReportTable from './components/ReportTable';
import ExportButtons from './components/ExportButtons';
import { RECURRENCE_OPTIONS } from '../../utils/expenseRecurrence';

const PIE_COLORS = [theme.colors.accentBlue, theme.colors.accentGreen, theme.colors.accentAmber, theme.colors.accentPurple];

export default function ExpenseReport() {
  const [range, setRange] = useState(getDefaultRange());
  const [recurrence, setRecurrence] = useState('');
  const [data, setData] = useState(null);

  const filters = { dateFrom: range.dateFrom, dateTo: range.dateTo, recurrence: recurrence || null };

  useEffect(() => {
    window.api.reports.getExpenseReport({ filters }).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.dateFrom, range.dateTo, recurrence]);

  if (!data) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader
        title="Expense Report"
        actions={<ExportButtons rows={data.rows} columns={data.columns} reportType="expenses" filters={filters} suggestedName="expense-report.csv" />}
      />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <DateRangePicker value={range} onChange={setRange} />
        <div style={{ marginTop: theme.spacing.sm, maxWidth: '260px' }}>
          <Label>Recurrence Type</Label>
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            <option value="">All Types</option>
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <ReportSummaryCards items={data.summary} />

      <Card style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <h4 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Expenses by Recurrence Type</h4>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data.chartData} dataKey="value" nameKey="name" outerRadius={90}>
              {data.chartData.map((entry, i) => (
                <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card style={{ padding: 0 }}>
        <ReportTable columns={data.columns} rows={data.rows} />
      </Card>
    </div>
  );
}
