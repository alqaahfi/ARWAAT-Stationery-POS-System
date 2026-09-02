import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { Card, PageHeader, Label, Select, Checkbox } from '../../components/ui';
import ReportSummaryCards from './components/ReportSummaryCards';
import ReportTable from './components/ReportTable';
import ExportButtons from './components/ExportButtons';

const TIERS = ['C1', 'C2', 'C3', 'C4', 'C5'];

export default function CustomerStatements({ onNavigate }) {
  const [tier, setTier] = useState('');
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [data, setData] = useState(null);

  const filters = { tier: tier || null, onlyWithBalance };

  useEffect(() => {
    window.api.reports.getCustomerStatements({ filters }).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, onlyWithBalance]);

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
            <Label>Tier</Label>
            <Select value={tier} onChange={(e) => setTier(e.target.value)} style={{ width: '220px' }}>
              <option value="">All Tiers</option>
              <option value="NONE">None</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
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
