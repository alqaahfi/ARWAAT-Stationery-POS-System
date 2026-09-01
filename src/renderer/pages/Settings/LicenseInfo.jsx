import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

// Read-only — reactivation, if ever needed, is a separate out-of-scope flow.
export default function LicenseInfo() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.api.license.getStatus().then(setStatus);
  }, []);

  async function handleCopyMachineId() {
    if (!status?.machineId) return;
    try {
      await navigator.clipboard.writeText(status.machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access blocked — nothing more we can do here.
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
      <PageHeader title="License Info" />
      <Card style={{ maxWidth: '480px' }}>
        <InfoRow label="Machine ID" value={status.machineId} mono />
        <div style={{ marginTop: '4px', marginBottom: theme.spacing.md }}>
          <Button variant="secondary" style={{ padding: '6px 12px', fontSize: theme.font.sizeXs }} onClick={handleCopyMachineId}>
            {copied ? 'Copied' : 'Copy Machine ID'}
          </Button>
        </div>

        {user.role === 'admin' && status.shopName && <InfoRow label="Shop Name" value={status.shopName} />}
        <InfoRow label="Role" value={status.role} capitalize />
        {status.stationCode && <InfoRow label="Station Code" value={status.stationCode} />}
        {status.adminHost && <InfoRow label="Admin PC Address" value={status.adminHost} />}
        <InfoRow label="Activated" value={formatDateTime(status.activatedAt)} />
      </Card>
    </div>
  );
}

function InfoRow({ label, value, mono, capitalize }) {
  return (
    <div style={{ marginBottom: theme.spacing.md }}>
      <div style={styles.label}>{label}</div>
      <div style={{ ...styles.value, ...(mono ? styles.mono : {}), ...(capitalize ? { textTransform: 'capitalize' } : {}) }}>
        {value || '—'}
      </div>
    </div>
  );
}

const styles = {
  label: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, textTransform: 'uppercase', letterSpacing: '0.03em' },
  value: { color: theme.colors.textPrimary, fontSize: theme.font.sizeBase, marginTop: '2px', wordBreak: 'break-all' },
  mono: { fontFamily: 'monospace', fontSize: theme.font.sizeSm },
};
