import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import theme from '../../config/theme';
import { Card, PageHeader, Label, Select, tableStyles, Tr } from '../../components/ui';
import ReportSummaryCards from './components/ReportSummaryCards';
import ExportButtons from './components/ExportButtons';
import { formatCell } from './utils/formatCell';

const PIE_COLORS = [theme.colors.accentBlue, theme.colors.accentGreen, theme.colors.accentAmber, theme.colors.accentPurple];

const STATUS_STYLE = {
  Normal: { backgroundColor: theme.colors.successBackground, color: theme.colors.success },
  Low: { backgroundColor: theme.colors.warningBackground, color: theme.colors.warning },
  Dead: { backgroundColor: theme.colors.dangerBackground, color: theme.colors.danger },
};

export default function StockReport() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    window.api.categories.list().then(setCategories);
  }, []);

  const filters = { categoryId: categoryId ? Number(categoryId) : null };

  useEffect(() => {
    window.api.reports.getStockReport({ filters }).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  if (!data) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader
        title="Stock Report"
        actions={<ExportButtons rows={data.rows} columns={data.columns} reportType="stock" filters={filters} suggestedName="stock-report.csv" />}
      />

      <Card style={{ marginBottom: theme.spacing.md, maxWidth: '280px' }}>
        <Label>Category</Label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Card>

      <ReportSummaryCards items={data.summary} />

      <Card style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <h4 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Stock Valuation by Category</h4>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data.chartData} dataKey="valuation" nameKey="name" outerRadius={90}>
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
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Product</th>
                <th style={tableStyles.th}>Category</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Total Stock</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Valuation</th>
                <th style={tableStyles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <Tr key={r.id}>
                  <td style={tableStyles.td}>{r.name}</td>
                  <td style={tableStyles.td}>{r.category_name}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>{formatCell(r.total_stock, 'number')}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>{formatCell(r.valuation, 'currency')}</td>
                  <td style={tableStyles.td}>
                    <span style={{ ...styles.badge, ...STATUS_STYLE[r.status] }}>{r.status}</span>
                  </td>
                </Tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={tableStyles.emptyState}>
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const styles = {
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: theme.radius.sm, fontSize: theme.font.sizeXs },
};
