import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, tableStyles, Tr } from '../../components/ui';
import { formatCurrencyExact, formatDateOnly } from '../../utils/format';

// Route: /ledgers/aging. Customers only — aging is a receivables concept.
export default function AgingReport({ onNavigate }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user.role !== 'admin') return;
    window.api.ledgers.getAgingReport().then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, [user.role]);

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Aging / Overdue" />

      <Card style={{ marginBottom: theme.spacing.md, color: theme.colors.textSecondary, fontSize: theme.font.sizeSm }}>
        <strong style={{ color: theme.colors.textPrimary }}>Method:</strong> age is computed from the oldest sale still
        carrying an unpaid balance at the time it was made, not a full FIFO reallocation of every payment against
        specific invoices — a reasonable practical approximation, not full accounting-grade aging.
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Customer</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Total Owed</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>0–30 Days</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>31–60 Days</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>61–90 Days</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>90+ Days</th>
                <th style={tableStyles.th}>Oldest Unpaid Invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.customerId} onClick={() => onNavigate('/ledgers/customers', { id: r.customerId, name: r.customerName })}>
                  <td style={tableStyles.td}>{r.customerName}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right', fontWeight: theme.font.weightMedium }}>
                    {formatCurrencyExact(r.totalOwed)}
                  </td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>{r.b0_30 ? formatCurrencyExact(r.b0_30) : '—'}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>{r.b31_60 ? formatCurrencyExact(r.b31_60) : '—'}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>{r.b61_90 ? formatCurrencyExact(r.b61_90) : '—'}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right', color: r.b90plus ? theme.colors.danger : theme.colors.textPrimary }}>
                    {r.b90plus ? formatCurrencyExact(r.b90plus) : '—'}
                  </td>
                  <td style={tableStyles.td}>{formatDateOnly(r.oldestUnpaidDate)}</td>
                </Tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={tableStyles.emptyState}>
                    No customers currently have an unpaid balance.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
