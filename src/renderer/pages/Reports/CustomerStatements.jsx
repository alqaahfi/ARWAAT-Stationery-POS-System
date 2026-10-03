import React, { useCallback, useMemo, useState } from 'react';
import glossary from '../../config/glossary';
import { Checkbox, Field, Select } from '../../components/ui';
import { PRICE_LEVELS, priceLevelLabel } from '../../utils/priceLevel';
import ExportButtons from './components/ExportButtons';
import ReportShell from './parts/ReportShell';
import { useReportData } from './parts/reportUtils';
import { StatementSummary, StatementTable } from './parts/StatementParts';

export default function CustomerStatements({ onNavigate }) {
  const [tier, setTier] = useState('');
  const [onlyWithBalance, setOnlyWithBalance] = useState(false);

  const filters = { tier: tier || null, onlyWithBalance };

  const { data, loading, error, retry } = useReportData(() => window.api.reports.getCustomerStatements({ filters }), [tier, onlyWithBalance]);

  const openAccount = useCallback((row) => onNavigate('/ledgers/customers', { id: row.id, name: row.name }), [onNavigate]);
  const tableColumns = useMemo(() => (data ? data.columns.filter((c) => c.key !== 'id') : []), [data]);

  return (
    <ReportShell
      intro="Who owes you money."
      filters={
        <>
          <Field label="Price Level" style={{ marginBottom: 0 }}>
            <Select value={tier} onChange={(e) => setTier(e.target.value)} style={{ width: '200px' }}>
              <option value="">All price levels</option>
              <option value="NONE">{glossary.noPriceLevel}</option>
              {PRICE_LEVELS.map((t) => (
                <option key={t} value={t}>
                  {priceLevelLabel(t)}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox
            label="Only customers who owe"
            checked={onlyWithBalance}
            onChange={(e) => setOnlyWithBalance(e.target.checked)}
            style={{ marginTop: 0, height: '36px' }}
          />
        </>
      }
      exportAction={
        <ExportButtons rows={data?.rows || []} columns={data?.columns || []} reportType="customers" filters={filters} suggestedName="customer-statements.csv" />
      }
      loading={loading}
      error={error}
      onRetry={retry}
      isEmpty={!!data && data.rows.length === 0}
      emptyHint={onlyWithBalance ? 'Nobody owes you money right now.' : 'No customers match these filters.'}
      summary={data && <StatementSummary data={data} party="customer" />}
      footnotes={['Balances include every sale, payment, return and correction up to today.']}
    >
      {data && <StatementTable columns={tableColumns} rows={data.rows} party="customer" onRowClick={openAccount} />}
    </ReportShell>
  );
}
