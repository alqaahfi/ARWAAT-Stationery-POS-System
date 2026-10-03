import React, { useCallback, useState } from 'react';
import { Checkbox } from '../../components/ui';
import ExportButtons from './components/ExportButtons';
import ReportShell from './parts/ReportShell';
import { useReportData } from './parts/reportUtils';
import { StatementSummary, StatementTable } from './parts/StatementParts';

// Suppliers have no category concept in the schema (unlike customers), so
// this report's only filter is the balance toggle — same table/summary shape
// as Customer Statements otherwise.
export default function SupplierStatements({ onNavigate }) {
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);

  const filters = { onlyWithBalance };

  const { data, loading, error, retry } = useReportData(() => window.api.reports.getSupplierStatements({ filters }), [onlyWithBalance]);

  const openAccount = useCallback((row) => onNavigate?.('/ledgers/suppliers', { id: row.id, name: row.name }), [onNavigate]);

  return (
    <ReportShell
      intro="Who you owe money to."
      filters={
        <Checkbox
          label="Only suppliers I owe"
          checked={onlyWithBalance}
          onChange={(e) => setOnlyWithBalance(e.target.checked)}
          style={{ marginTop: 0, height: '36px' }}
        />
      }
      exportAction={
        <ExportButtons rows={data?.rows || []} columns={data?.columns || []} reportType="suppliers" filters={filters} suggestedName="supplier-statements.csv" />
      }
      loading={loading}
      error={error}
      onRetry={retry}
      isEmpty={!!data && data.rows.length === 0}
      emptyHint={onlyWithBalance ? "You don't owe any supplier right now." : 'No suppliers yet.'}
      summary={data && <StatementSummary data={data} party="supplier" />}
      footnotes={['Balances include every purchase, payment and correction up to today.']}
    >
      {data && <StatementTable columns={data.columns} rows={data.rows} party="supplier" onRowClick={onNavigate ? openAccount : undefined} />}
    </ReportShell>
  );
}
