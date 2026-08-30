import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { Card, PageHeader, tableStyles, Tr } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

const STATUS_STYLE = {
  success: { color: theme.colors.success },
  failed: { color: theme.colors.danger },
};

export default function SyncAndPcs() {
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState([]);

  useEffect(() => {
    window.api.sync.getStatus().then(setStatus);
    window.api.sync.getLog().then(setLog);
  }, []);

  if (!status) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader title="Sync & PCs" />

      <div style={styles.limitationBanner}>
        Not yet connected — this page shows what this PC knows about itself only. Full multi-PC sync (pushing/pulling between
        the Admin PC and Cashier PCs) isn't built yet.
      </div>

      <Card style={{ marginBottom: theme.spacing.lg }}>
        <h4 style={{ margin: '0 0 12px', color: theme.colors.textPrimary }}>This PC</h4>
        {status.thisPc ? (
          <div style={styles.infoGrid}>
            <InfoItem label="Role" value={status.thisPc.role} capitalize />
            <InfoItem label="Station Code" value={status.thisPc.stationCode || '—'} />
            <InfoItem label="Shop Name" value={status.thisPc.shopName} />
            {status.thisPc.adminHost && <InfoItem label="Admin PC Address" value={status.thisPc.adminHost} />}
            <InfoItem label="Activated" value={formatDateTime(status.thisPc.activatedAt)} />
          </div>
        ) : (
          <div style={{ color: theme.colors.textSecondary }}>Not activated.</div>
        )}

        <div style={styles.statRow}>
          <InfoItem label="Pending Sync Items" value={status.pendingCount} />
          <InfoItem
            label="Last Sync"
            value={status.lastSync ? `${status.lastSync.status} · ${formatDateTime(status.lastSync.created_at)}` : 'Never'}
          />
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.colors.border}`, fontWeight: theme.font.weightSemibold, color: theme.colors.textPrimary }}>
          Recent Sync Log
        </div>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Date</th>
                <th style={tableStyles.th}>Direction</th>
                <th style={tableStyles.th}>Status</th>
                <th style={tableStyles.th}>Message</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry) => (
                <Tr key={entry.id}>
                  <td style={tableStyles.td}>{formatDateTime(entry.created_at)}</td>
                  <td style={{ ...tableStyles.td, textTransform: 'capitalize' }}>{entry.direction}</td>
                  <td style={{ ...tableStyles.td, ...STATUS_STYLE[entry.status], textTransform: 'capitalize' }}>{entry.status}</td>
                  <td style={tableStyles.td}>{entry.message || '—'}</td>
                </Tr>
              ))}
              {log.length === 0 && (
                <tr>
                  <td colSpan={4} style={tableStyles.emptyState}>
                    No sync activity recorded yet.
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

function InfoItem({ label, value, capitalize }) {
  return (
    <div>
      <div style={styles.infoLabel}>{label}</div>
      <div style={{ ...styles.infoValue, ...(capitalize ? { textTransform: 'capitalize' } : {}) }}>{value}</div>
    </div>
  );
}

const styles = {
  limitationBanner: {
    backgroundColor: theme.colors.infoBackground,
    color: theme.colors.info,
    border: `1px solid ${theme.colors.info}`,
    borderRadius: theme.radius.md,
    padding: '10px 14px',
    fontSize: theme.font.sizeSm,
    marginBottom: theme.spacing.md,
  },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: theme.spacing.md },
  statRow: {
    display: 'flex',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  infoLabel: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, textTransform: 'uppercase', letterSpacing: '0.03em' },
  infoValue: { color: theme.colors.textPrimary, fontSize: theme.font.sizeBase, marginTop: '2px', fontWeight: theme.font.weightMedium },
};
