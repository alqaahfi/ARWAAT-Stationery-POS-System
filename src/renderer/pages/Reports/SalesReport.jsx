import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Field, Select } from '../../components/ui';
import DateRangePicker, { getDefaultRange } from './components/DateRangePicker';
import ExportButtons from './components/ExportButtons';
import ReportShell from './parts/ReportShell';
import { useReportData } from './parts/reportUtils';
import { SalesSummary, SalesChart, SalesTable } from './parts/SalesReportParts';

// `initialDate` lets another screen's drill-down (the Dashboard's revenue
// chart, same click-a-bar pattern this report introduced) land here already
// scoped to the day that was clicked, instead of a second bespoke report.
export default function SalesReport({ initialDate }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [range, setRange] = useState(() => (initialDate ? { preset: 'custom', dateFrom: initialDate, dateTo: initialDate } : getDefaultRange()));
  const [cashierId, setCashierId] = useState('');
  const [saleType, setSaleType] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [cashiers, setCashiers] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    if (isAdmin) window.api.users.list().then((rows) => setCashiers(rows.filter((r) => r.role === 'cashier')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    cashierId: cashierId ? Number(cashierId) : null,
    saleType,
    paymentStatus,
  };

  // The server locks a cashier to their own sales whatever is sent here.
  const { data, loading, error, retry } = useReportData(() => {
    setSelectedDay(null);
    return window.api.reports.getSalesReport({ filters, requestingUserId: user.id });
  }, [range.dateFrom, range.dateTo, cashierId, saleType, paymentStatus]);

  const tableRows = useMemo(() => {
    if (!data) return [];
    return selectedDay ? data.rows.filter((r) => r.sale_day === selectedDay) : data.rows;
  }, [data, selectedDay]);

  const toggleDay = useCallback((day) => setSelectedDay((prev) => (prev === day ? null : day)), []);

  const isEmpty = !!data && data.rows.length === 0 && !(data.returnsTotal > 0);

  return (
    <ReportShell
      intro="How much you sold, and to whom."
      filters={
        <>
          <DateRangePicker value={range} onChange={setRange} />
          {isAdmin && (
            <Field label="Cashier" style={{ marginBottom: 0 }}>
              <Select value={cashierId} onChange={(e) => setCashierId(e.target.value)} style={{ width: '180px' }}>
                <option value="">All Cashiers</option>
                {cashiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Sale Type" style={{ marginBottom: 0 }}>
            <Select value={saleType} onChange={(e) => setSaleType(e.target.value)} style={{ width: '140px' }}>
              <option value="all">All</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </Select>
          </Field>
          <Field label="Payment Status" style={{ marginBottom: 0 }}>
            <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} style={{ width: '140px' }}>
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </Select>
          </Field>
        </>
      }
      exportAction={
        <ExportButtons
          rows={tableRows}
          columns={data?.columns || []}
          reportType="sales"
          filters={{ ...filters, requestingUserId: user.id }}
          suggestedName="sales-report.csv"
        />
      }
      loading={loading}
      error={error}
      onRetry={retry}
      isEmpty={isEmpty}
      summary={data && <SalesSummary data={data} />}
      footnotes={['Payment status shows how each sale was paid at the time it was made.', data?.returnsTotal > 0 && 'Returns come off sales on the day the items were returned.']}
    >
      {data && (
        <>
          <SalesChart data={data.chartData} selectedDay={selectedDay} onDayClick={toggleDay} />
          <SalesTable columns={data.columns} rows={tableRows} selectedDay={selectedDay} onClearDay={() => setSelectedDay(null)} />
        </>
      )}
    </ReportShell>
  );
}
