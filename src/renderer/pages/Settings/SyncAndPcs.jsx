import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, tableStyles, Tr } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

const REFRESH_INTERVAL_MS = 5000;

const STATUS_STYLE = {
  success: { color: theme.colors.success },
  failed: { color: theme.colors.danger },
};

export default function SyncAndPcs({ onNavigate }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [peers, setPeers] = useState([]);
  const [log, setLog] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [syncingPeer, setSyncingPeer] = useState(null); // machineId, or 'all'

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadAll() {
    window.api.sync.getStatus().then(setStatus);
    window.api.sync.getPeers().then(setPeers);
    window.api.sync.getLog().then(setLog);
    window.api.sync.getReconciliationWarnings().then(setWarnings);
    if (user.role === 'admin') window.api.sync.getSecret().then(setSecret);
  }

  async function handleSyncNow(peerMachineId) {
    setSyncingPeer(peerMachineId || 'all');
    try {
      await window.api.sync.triggerNow(peerMachineId ? { peerMachineId } : {});
    } finally {
      loadAll();
      setSyncingPeer(null);
    }
  }

  async function handleCopySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access blocked — the code is still shown on screen to copy by hand.
    }
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  if (!status) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader
        title="Sync & PCs"
        actions={
          <Button onClick={() => handleSyncNow(null)} disabled={syncingPeer !== null}>
            {syncingPeer === 'all' ? 'Syncing…' : 'Sync Now'}
          </Button>
        }
      />

      <Card style={{ marginBottom: theme.spacing.lg }}>
        <h4 style={{ margin: '0 0 12px', color: theme.colors.textPrimary }}>This PC</h4>
        {status.thisPc ? (
          <div style={styles.infoGrid}>
            <InfoItem label="Role" value={status.thisPc.role} capitalize />
            <InfoItem label="Station Code" value={status.thisPc.stationCode || '—'} />
            <InfoItem label="Shop Name" value={status.thisPc.shopName} />
            <InfoItem label="Activated" value={formatDateTime(status.thisPc.activatedAt)} />
          </div>
        ) : (
          <div style={{ color: theme.colors.textSecondary }}>Not activated.</div>
        )}

        <div style={styles.statRow}>
          <InfoItem label="Unsynced Outbox Rows" value={status.outboxCount} />
          <InfoItem
            label="Last Sync Attempt"
            value={status.lastSync ? `${status.lastSync.status} · ${formatDateTime(status.lastSync.created_at)}` : 'Never'}
          />
        </div>
      </Card>

      <Card style={{ marginBottom: theme.spacing.lg }}>
        <h4 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Sync Secret</h4>
        <p style={{ margin: '0 0 12px', color: theme.colors.textSecondary, fontSize: theme.font.sizeSm }}>
          Enter this exact code when setting up a new Cashier PC, so it can talk to this one securely.
        </p>
        <div style={styles.secretBox}>{secret || '—'}</div>
        <Button variant="secondary" onClick={handleCopySecret} style={{ marginTop: '10px' }}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Card>

      {warnings.length > 0 && (
        <Card style={{ marginBottom: theme.spacing.lg, border: `1px solid ${theme.colors.danger}` }}>
          <h4 style={{ margin: '0 0 4px', color: theme.colors.danger }}>Stock Reconciliation Needed</h4>
          <p style={{ margin: '0 0 12px', color: theme.colors.textSecondary, fontSize: theme.font.sizeSm }}>
            These variants went negative — two PCs likely sold the last unit while offline from each other. Correct them
            via Stock Adjustments.
          </p>
          <div style={tableStyles.scroll}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Product</th>
                  <th style={tableStyles.th}>Variant</th>
                  <th style={tableStyles.th}>Stock Qty</th>
                  <th style={tableStyles.th} />
                </tr>
              </thead>
              <tbody>
                {warnings.map((w) => (
                  <Tr key={w.variantId}>
                    <td style={tableStyles.td}>
                      {w.productName} {w.sku ? `(${w.sku})` : ''}
                    </td>
                    <td style={tableStyles.td}>{w.variantName}</td>
                    <td style={{ ...tableStyles.td, color: theme.colors.danger, fontWeight: theme.font.weightSemibold }}>
                      {w.stockQty}
                    </td>
                    <td style={tableStyles.td}>
                      {onNavigate && (
                        <Button
                          variant="secondary"
                          style={{ padding: '4px 10px', fontSize: theme.font.sizeXs }}
                          onClick={() => onNavigate('/products/stock-adjustments', { productId: w.productId })}
                        >
                          Fix in Stock Adjustments
                        </Button>
                      )}
                    </td>
                  </Tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card style={{ padding: 0, marginBottom: theme.spacing.lg }}>
        <div style={styles.sectionHeader}>Known PCs</div>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Station</th>
                <th style={tableStyles.th}>Role</th>
                <th style={tableStyles.th}>Status</th>
                <th style={tableStyles.th}>IP Address</th>
                <th style={tableStyles.th}>Last Successful Sync</th>
                <th style={tableStyles.th} />
              </tr>
            </thead>
            <tbody>
              {peers.map((p) => (
                <Tr key={p.machineId}>
                  <td style={tableStyles.td}>{p.stationCode || '—'}</td>
                  <td style={{ ...tableStyles.td, textTransform: 'capitalize' }}>{p.role || '—'}</td>
                  <td style={{ ...tableStyles.td, color: p.online ? theme.colors.success : theme.colors.textSecondary }}>
                    {p.online ? 'Online' : 'Offline'}
                  </td>
                  <td style={tableStyles.td}>{p.ip || '—'}</td>
                  <td style={tableStyles.td}>{p.lastSyncSuccessAt ? formatDateTime(p.lastSyncSuccessAt) : 'Never'}</td>
                  <td style={tableStyles.td}>
                    <Button
                      variant="secondary"
                      style={{ padding: '4px 10px', fontSize: theme.font.sizeXs }}
                      disabled={syncingPeer !== null}
                      onClick={() => handleSyncNow(p.machineId)}
                    >
                      {syncingPeer === p.machineId ? 'Syncing…' : 'Sync Now'}
                    </Button>
                  </td>
                </Tr>
              ))}
              {peers.length === 0 && (
                <tr>
                  <td colSpan={6} style={tableStyles.emptyState}>
                    No other PCs found on the network yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={styles.sectionHeader}>Recent Sync Log</div>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Date</th>
                <th style={tableStyles.th}>Peer</th>
                <th style={tableStyles.th}>Status</th>
                <th style={tableStyles.th}>Message</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry) => (
                <Tr key={entry.id}>
                  <td style={tableStyles.td}>{formatDateTime(entry.created_at)}</td>
                  <td style={tableStyles.td}>{entry.peer_station_code || entry.peer_machine_id || '—'}</td>
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
  secretBox: {
    padding: '10px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.appBackground,
    border: `1px solid ${theme.colors.border}`,
    fontFamily: 'monospace',
    fontSize: theme.font.sizeSm,
    wordBreak: 'break-all',
    color: theme.colors.info,
  },
  sectionHeader: {
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    fontWeight: theme.font.weightSemibold,
    color: theme.colors.textPrimary,
  },
};
