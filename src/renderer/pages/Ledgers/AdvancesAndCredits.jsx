import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, tableStyles, Tr } from '../../components/ui';
import { formatCurrencyExact, formatDateTime } from '../../utils/format';

// Route: /ledgers/advances. Every customer AND supplier currently holding a
// negative balance (an advance/credit), sorted largest first — the dedicated
// view for "how much has this customer given us in advance."
export default function AdvancesAndCredits({ onNavigate }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user.role !== 'admin') return;
    window.api.ledgers.getAdvances().then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, [user.role]);

  function goToLedger(row) {
    if (row.partyType === 'customer') onNavigate('/ledgers/customers', { id: row.partyId, name: row.partyName });
    else onNavigate('/ledgers/suppliers', { id: row.partyId, name: row.partyName });
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Advances & Credits" />

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Party Name</th>
                <th style={tableStyles.th}>Party Type</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Advance Held</th>
                <th style={tableStyles.th}>Last Related Transaction</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={`${r.partyType}-${r.partyId}`} onClick={() => goToLedger(r)}>
                  <td style={tableStyles.td}>{r.partyName}</td>
                  <td style={{ ...tableStyles.td, textTransform: 'capitalize' }}>{r.partyType}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right', color: theme.colors.info, fontWeight: theme.font.weightMedium }}>
                    {formatCurrencyExact(r.advanceAmount)}
                  </td>
                  <td style={tableStyles.td}>{r.lastActivity ? formatDateTime(r.lastActivity) : '—'}</td>
                </Tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} style={tableStyles.emptyState}>
                    No customer or supplier is currently holding an advance/credit.
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
