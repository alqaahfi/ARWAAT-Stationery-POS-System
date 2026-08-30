import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import theme from '../../config/theme';
import { Card, PageHeader, Label, Select } from '../../components/ui';
import DateRangePicker, { getDefaultRange } from './components/DateRangePicker';
import ReportSummaryCards from './components/ReportSummaryCards';
import ReportTable from './components/ReportTable';
import ExportButtons from './components/ExportButtons';

const PIE_COLORS = [theme.colors.accentBlue, theme.colors.accentGreen, theme.colors.accentAmber, theme.colors.accentPurple];

export default function ExpenseReport() {
  const [range, setRange] = useState(getDefaultRange());
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    window.api.expenseCategories.list().then(setCategories);
  }, []);

  const filters = { dateFrom: range.dateFrom, dateTo: range.dateTo, categoryId: categoryId ? Number(categoryId) : null };

  useEffect(() => {
    window.api.reports.getExpenseReport({ filters }).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.dateFrom, range.dateTo, categoryId]);

  if (!data) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader
        title="Expense Report"
        actions={<ExportButtons rows={data.rows} columns={data.columns} reportType="expenses" filters={filters} suggestedName="expense-report.csv" />}
      />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <DateRangePicker value={range} onChange={setRange} />
        {categories.length > 0 && (
          <div style={{ marginTop: theme.spacing.sm, maxWidth: '260px' }}>
            <Label>Expense Category</Label>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      <ReportSummaryCards items={data.summary} />

      <Card style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <h4 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Expenses by Category</h4>
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
