import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { Card, PageHeader, Checkbox } from '../../components/ui';
import ReportSummaryCards from './components/ReportSummaryCards';
import ReportTable from './components/ReportTable';
import ExportButtons from './components/ExportButtons';

// Suppliers have no category concept in the schema (unlike customers), so
// this report's only filter is the balance toggle — same table/summary shape
// as Customer Statements otherwise. Balances are now fully accurate: the
// Suppliers module's `purchases` table closed the gap that used to leave
// this report reflecting payments only.
export default function SupplierStatements() {
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);
  const [data, setData] = useState(null);

  const filters = { onlyWithBalance };

  useEffect(() => {
    window.api.reports.getSupplierStatements({ filters }).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyWithBalance]);

  if (!data) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader
        title="Supplier Statements"
        actions={
          <ExportButtons rows={data.rows} columns={data.columns} reportType="suppliers" filters={filters} suggestedName="supplier-statements.csv" />
        }
      />

      <Card style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <Checkbox label="Only show suppliers with a balance owed" checked={onlyWithBalance} onChange={(e) => setOnlyWithBalance(e.target.checked)} />
      </Card>

      <ReportSummaryCards items={data.summary} />

      <Card style={{ padding: 0, marginTop: theme.spacing.md }}>
        <ReportTable columns={data.columns} rows={data.rows} />
      </Card>
    </div>
  );
}
