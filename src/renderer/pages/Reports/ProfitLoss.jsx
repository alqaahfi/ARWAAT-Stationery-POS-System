import React, { useState } from 'react';
import DateRangePicker, { getDefaultRange } from './components/DateRangePicker';
import ExportButtons from './components/ExportButtons';
import ReportShell from './parts/ReportShell';
import { useReportData } from './parts/reportUtils';
import { ProfitSummary, ProfitChart, ProfitTable } from './parts/ProfitLossParts';

export default function ProfitLoss() {
  const [range, setRange] = useState(getDefaultRange());

  const filters = { dateFrom: range.dateFrom, dateTo: range.dateTo };

  const { data, loading, error, retry } = useReportData(() => window.api.reports.getProfitLoss({ filters }), [range.dateFrom, range.dateTo]);

  return (
    <ReportShell
      intro="What you earned after the cost of goods and your expenses."
      filters={<DateRangePicker value={range} onChange={setRange} />}
      exportAction={
        <ExportButtons rows={data?.rows || []} columns={data?.columns || []} reportType="profit-loss" filters={filters} suggestedName="profit-loss.csv" />
      }
      loading={loading}
      error={error}
      onRetry={retry}
      isEmpty={!!data && data.rows.length === 0}
      summary={data && <ProfitSummary data={data} />}
      footnotes={[
        'Cost of goods uses the buying prices saved today, not the prices at the time of each sale.',
        'Returned items that go back into stock are taken out of both sales and cost.',
      ]}
    >
      {data && (
        <>
          <ProfitChart rows={data.chartData} unit={data.bucketUnit} />
          <ProfitTable columns={data.columns} rows={data.rows} totals={data.totals} unit={data.bucketUnit} />
        </>
      )}
    </ReportShell>
  );
}
