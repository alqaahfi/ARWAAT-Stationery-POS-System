import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Tr, tableStyles } from '../../components/ui';
import { formatCurrency } from '../../utils/format';

// Route: /ledgers. The module's landing page — a quick pulse check, distinct
// from the full Reports module (Customer/Supplier Statements there stay
// high-level balance summaries; this module is the day-to-day workspace).
export default function Overview({ onNavigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (user.role !== 'admin') return;
    window.api.ledgers.getOverview().then(setData);
  }, [user.role]);

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  if (!data) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader title="Ledgers Overview" />

      <div style={styles.statGrid}>
        <StatTile label="Total Receivable" value={data.totalReceivable} tone="danger" />
        <StatTile label="Total Payable" value={data.totalPayable} tone="danger" />
        <StatTile label="Total Advances Held" value={data.totalAdvancesHeld} tone="info" />
        <StatTile label="Total Prepaid to Suppliers" value={data.totalPrepaidToSuppliers} tone="info" />
      </div>

      <div style={styles.attentionGrid}>
        <NeedsAttentionList
          title="Top Outstanding Customers"
          rows={data.topCustomers}
          emptyText="No customers currently owe a balance."
          onRowClick={(row) => onNavigate('/ledgers/customers', { id: row.id, name: row.name })}
        />
        <NeedsAttentionList
          title="Top Outstanding Suppliers"
          rows={data.topSuppliers}
          emptyText="No balances currently owed to suppliers."
          onRowClick={(row) => onNavigate('/ledgers/suppliers', { id: row.id, name: row.name })}
        />
      </div>
    </div>
  );
}

// Advances/prepaid amounts use `info` (a calm, non-alarming color) — they're
// money the shop is holding, not a debt, so they shouldn't read as "red".
function StatTile({ label, value, tone }) {
  const color = tone === 'danger' ? theme.colors.danger : theme.colors.info;
  return (
    <Card style={styles.tile}>
      <div style={styles.tileLabel}>{label}</div>
      <div style={{ ...styles.tileValue, color }}>{formatCurrency(value)}</div>
    </Card>
  );
}

function NeedsAttentionList({ title, rows, emptyText, onRowClick }) {
  return (
    <Card style={{ padding: 0 }}>
      <div style={styles.listHeader}>{title}</div>
      <div style={tableStyles.scroll}>
        <table style={tableStyles.table}>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id} onClick={() => onRowClick(row)}>
                <td style={tableStyles.td}>{row.name}</td>
                <td style={{ ...tableStyles.td, textAlign: 'right', color: theme.colors.danger, fontWeight: theme.font.weightMedium }}>
                  {formatCurrency(row.balance)}
                </td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td style={tableStyles.emptyState}>{emptyText}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const styles = {
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  tile: { padding: '18px' },
  tileLabel: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, textTransform: 'uppercase', letterSpacing: '0.03em' },
  tileValue: { fontSize: theme.font.sizeXl, fontWeight: theme.font.weightSemibold, marginTop: '6px' },
  attentionGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md },
  listHeader: {
    padding: '12px 14px',
    fontWeight: theme.font.weightSemibold,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeSm,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
};
