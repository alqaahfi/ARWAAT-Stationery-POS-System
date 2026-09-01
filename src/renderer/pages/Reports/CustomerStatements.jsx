import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { Card, PageHeader, Label, Select, Checkbox } from '../../components/ui';
import ReportSummaryCards from './components/ReportSummaryCards';
import ReportTable from './components/ReportTable';
import ExportButtons from './components/ExportButtons';

export default function CustomerStatements({ onNavigate }) {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    window.api.customerCategories.list().then(setCategories);
  }, []);

  const filters = { categoryId: categoryId ? Number(categoryId) : null, onlyWithBalance };

  useEffect(() => {
    window.api.reports.getCustomerStatements({ filters }).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, onlyWithBalance]);

  if (!data) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader
        title="Customer Statements"
        actions={
          <ExportButtons rows={data.rows} columns={data.columns} reportType="customers" filters={filters} suggestedName="customer-statements.csv" />
        }
      />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.filterRow}>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: '220px' }}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <Checkbox label="Only show customers with a balance owed" checked={onlyWithBalance} onChange={(e) => setOnlyWithBalance(e.target.checked)} />
        </div>
      </Card>

      <ReportSummaryCards items={data.summary} />

      <Card style={{ padding: 0, marginTop: theme.spacing.md }}>
        <ReportTable
          columns={data.columns.filter((c) => c.key !== 'id')}
          rows={data.rows}
          onRowClick={(row) => onNavigate('/ledgers/customers', { id: row.id, name: row.name })}
        />
      </Card>
    </div>
  );
}

const styles = {
  filterRow: { display: 'flex', alignItems: 'flex-end', gap: theme.spacing.lg },
};
