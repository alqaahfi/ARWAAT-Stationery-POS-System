import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, Select, Button } from '../../components/ui';
import DateRangePicker, { getDefaultRange } from './components/DateRangePicker';
import ReportSummaryCards from './components/ReportSummaryCards';
import ReportTable from './components/ReportTable';
import ExportButtons from './components/ExportButtons';

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
  const [data, setData] = useState(null);
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

  useEffect(() => {
    setSelectedDay(null);
    window.api.reports.getSalesReport({ filters, requestingUserId: user.id }).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.dateFrom, range.dateTo, cashierId, saleType, paymentStatus]);

  if (!data) return <Card>Loading…</Card>;

  const tableRows = selectedDay ? data.rows.filter((r) => r.created_at.slice(0, 10) === selectedDay) : data.rows;

  return (
    <div>
      <PageHeader
        title="Sales Report"
        actions={
          <ExportButtons
            rows={tableRows}
            columns={data.columns}
            reportType="sales"
            filters={{ ...filters, requestingUserId: user.id }}
            suggestedName="sales-report.csv"
          />
        }
      />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <DateRangePicker value={range} onChange={setRange} />
        <div style={styles.filterRow}>
          {isAdmin && (
            <div>
              <Label>Cashier</Label>
              <Select value={cashierId} onChange={(e) => setCashierId(e.target.value)} style={{ width: '200px' }}>
                <option value="">All Cashiers</option>
                {cashiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label>Sale Type</Label>
            <Select value={saleType} onChange={(e) => setSaleType(e.target.value)} style={{ width: '160px' }}>
              <option value="all">All</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
            </Select>
          </div>
          <div>
            <Label>Payment Status</Label>
            <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} style={{ width: '160px' }}>
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </Select>
          </div>
        </div>
      </Card>

      <ReportSummaryCards items={data.summary} />

      <Card style={{ marginTop: theme.spacing.md, marginBottom: theme.spacing.md }}>
        <div style={styles.chartHeader}>
          <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>Revenue by Day</h4>
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeXs }}>Click a bar to filter the table below</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: theme.colors.textSecondary }} />
            <YAxis tick={{ fontSize: 11, fill: theme.colors.textSecondary }} />
            <Tooltip />
            <Bar
              dataKey="revenue"
              fill={theme.colors.accentBlue}
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(entry) => {
                // recharts' Bar onClick payload shape has shifted across
                // versions — the original datum lands either directly on the
                // arg or nested under .payload, so check both defensively.
                const day = entry?.payload?.date ?? entry?.date;
                if (day) setSelectedDay((prev) => (prev === day ? null : day));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card style={{ padding: 0 }}>
        {selectedDay && (
          <div style={styles.filterBanner}>
            Showing only {selectedDay}
            <Button variant="ghost" style={{ padding: '4px 10px', fontSize: theme.font.sizeXs }} onClick={() => setSelectedDay(null)}>
              Clear
            </Button>
          </div>
        )}
        <ReportTable columns={data.columns} rows={tableRows} />
      </Card>
    </div>
  );
}

const styles = {
  filterRow: { display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  chartHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  filterBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    backgroundColor: theme.colors.infoBackground,
    color: theme.colors.info,
    fontSize: theme.font.sizeSm,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
};
