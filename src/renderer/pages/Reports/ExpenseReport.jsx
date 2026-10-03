import React, { useState } from 'react';
import { Field, Select } from '../../components/ui';
import DateRangePicker, { getDefaultRange } from './components/DateRangePicker';
import ExportButtons from './components/ExportButtons';
import ReportShell from './parts/ReportShell';
import { useReportData } from './parts/reportUtils';
import { ExpenseSummary, ExpenseByType, ExpenseTable } from './parts/ExpenseParts';
import { RECURRENCE_OPTIONS } from '../../utils/expenseRecurrence';

export default function ExpenseReport() {
  const [range, setRange] = useState(getDefaultRange());
  const [recurrence, setRecurrence] = useState('');

  const filters = { dateFrom: range.dateFrom, dateTo: range.dateTo, recurrence: recurrence || null };

  const { data, loading, error, retry } = useReportData(() => window.api.reports.getExpenseReport({ filters }), [range.dateFrom, range.dateTo, recurrence]);

  return (
    <ReportShell
      intro="Where your money went."
      filters={
        <>
          <DateRangePicker value={range} onChange={setRange} />
          <Field label="Repeats" style={{ marginBottom: 0 }}>
            <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} style={{ width: '180px' }}>
              <option value="">All Types</option>
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </>
      }
      exportAction={<ExportButtons rows={data?.rows || []} columns={data?.columns || []} reportType="expenses" filters={filters} suggestedName="expense-report.csv" />}
      loading={loading}
      error={error}
      onRetry={retry}
      isEmpty={!!data && data.rows.length === 0}
      summary={data && <ExpenseSummary data={data} />}
    >
      {data && (
        <>
          <ExpenseByType chartData={data.chartData} />
          <ExpenseTable columns={data.columns} rows={data.rows} />
        </>
      )}
    </ReportShell>
  );
}
