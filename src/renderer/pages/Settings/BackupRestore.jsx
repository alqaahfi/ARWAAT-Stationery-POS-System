import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, Banner } from '../../components/ui';

export default function BackupRestore() {
  const { user } = useAuth();

  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');
  const [restoredAwaitingRestart, setRestoredAwaitingRestart] = useState(false);

  async function handleExport() {
    setExporting(true);
    setExportMessage('');
    const res = await window.api.backup.export();
    setExporting(false);
    if (res.canceled) return;
    setExportMessage(res.success ? `Backup saved to ${res.filePath}` : res.reason || 'Could not export backup.');
  }

  async function handleRestore() {
    setError('');
    const confirmed = window.confirm(
      'This will replace ALL current data with the backup file. This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    setRestoring(true);
    const res = await window.api.backup.restore();
    setRestoring(false);

    if (res.canceled) return;
    if (!res.success) {
      setError(res.reason || 'Could not restore backup.');
      return;
    }
    setRestoredAwaitingRestart(true);
  }

  function handleRestartNow() {
    window.api.backup.relaunchApp();
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  if (restoredAwaitingRestart) {
    return (
      <div>
        <PageHeader title="Backup & Restore" />
        <Card style={{ maxWidth: '480px', textAlign: 'center', padding: '32px' }}>
          <h3 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Backup restored</h3>
          <p style={{ color: theme.colors.textSecondary }}>The app needs to restart to load the restored data.</p>
          <Button onClick={handleRestartNow} style={{ marginTop: theme.spacing.md }}>
            Restart Now
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Backup & Restore" />

      <Card style={{ maxWidth: '480px', marginBottom: theme.spacing.lg }}>
        <h4 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Export Backup</h4>
        <p style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeSm }}>
          Saves a copy of the current database file to a location you choose.
        </p>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export Backup'}
        </Button>
        {exportMessage && <div style={{ marginTop: theme.spacing.sm, fontSize: theme.font.sizeSm, color: theme.colors.textSecondary }}>{exportMessage}</div>}
      </Card>

      <Card style={{ maxWidth: '480px' }}>
        <h4 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Restore from Backup</h4>
        <p style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeSm }}>
          Replaces all current data with a previously exported backup file. The app will need to restart afterward.
        </p>
        <Button variant="danger" onClick={handleRestore} disabled={restoring}>
          {restoring ? 'Restoring…' : 'Restore from Backup'}
        </Button>
        <Banner>{error}</Banner>
      </Card>
    </div>
  );
}
