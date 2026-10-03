import React, { useState } from 'react';
import DateRangePicker, { getDefaultRange } from './components/DateRangePicker';
import ExportButtons from './components/ExportButtons';
import ReportShell from './parts/ReportShell';
import { useReportData } from './parts/reportUtils';
import { CashierSummary, CashierRanking, CashierTable } from './parts/CashierParts';

export default function CashierPerformance() {
  const [range, setRange] = useState(getDefaultRange());

  const filters = { dateFrom: range.dateFrom, dateTo: range.dateTo };

  const { data, loading, error, retry } = useReportData(() => window.api.reports.getCashierPerformance({ filters }), [range.dateFrom, range.dateTo]);

  return (
    <ReportShell
      intro="How each cashier did."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      exportAction={
        <ExportButtons rows={data?.rows || []} columns={data?.columns || []} reportType="cashiers" filters={filters} suggestedName="cashier-performance.csv" />
      }
      loading={loading}
      error={error}
      onRetry={retry}
      isEmpty={!!data && data.rows.length === 0}
      summary={data && <CashierSummary data={data} />}
      footnotes={['A return counts against the cashier who made the original sale, on the day it was returned.']}
    >
      {data && (
        <>
          <CashierRanking rows={data.rows} />
          <CashierTable columns={data.columns} rows={data.rows} />
        </>
      )}
    </ReportShell>
  );
}
