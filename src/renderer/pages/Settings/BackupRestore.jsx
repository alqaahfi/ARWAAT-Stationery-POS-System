import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../components/ui';
import { RestrictedNotice } from '../Parties/PartyParts';
import { settingsColumn } from './parts/SettingsParts';
import { AutoBackupCard, BackupCard, DangerZone, RestoreCard, RestoredCard } from './parts/BackupParts';

export default function BackupRestore() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [exporting, setExporting] = useState(false);
  const [savedPath, setSavedPath] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');
  const [restoredAwaitingRestart, setRestoredAwaitingRestart] = useState(false);
  // Rule 16: automatic daily backup status.
  const [autoStatus, setAutoStatus] = useState(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const loadAuto = useCallback(() => {
    window.api.backup.getAutoStatus().then(setAutoStatus).catch(() => {});
  }, []);
  useEffect(() => {
    if (user.role === 'admin') loadAuto();
  }, [user.role, loadAuto]);

  async function changeAutoFolder() {
    const res = await window.api.backup.pickAutoFolder();
    if (res?.canceled) return;
    if (!res?.success) {
      toast.error(res?.reason || "That folder can't be used.");
      return;
    }
    toast.success('Automatic backups will be saved there');
    loadAuto();
  }

  async function backupNow() {
    setAutoBusy(true);
    try {
      const res = await window.api.backup.runAutoNow();
      if (res?.success) toast.success('Backup saved');
      else toast.error(res?.reason || 'The backup failed.');
    } finally {
      setAutoBusy(false);
      loadAuto();
    }
  }

  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  async function handleExport() {
    setExporting(true);
    try {
      const res = await window.api.backup.export();
      if (res.canceled) return;
      if (res.success) {
        setSavedPath(res.filePath);
        toast.success('Backup saved');
      } else {
        toast.error(res.reason || 'Could not export backup.');
      }
    } catch {
      toast.error('Could not export backup. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  // Asks first, then the main process opens the file picker and swaps the
  // database in one call.
  async function handleRestore() {
    setError('');
    const ok = await confirm({
      title: 'Restore this backup?',
      message: 'This replaces everything on this computer with the backup. The app will restart.',
      confirmLabel: 'Restore',
      cancelLabel: 'Cancel',
      destructive: true,
    });
    if (!ok) return;

    setRestoring(true);
    try {
      const res = await window.api.backup.restore();
      if (res.canceled) return;
      if (!res.success) {
        setError(res.reason || 'Could not restore backup.');
        return;
      }
      setRestoredAwaitingRestart(true);
    } catch {
      setError('Could not restore backup. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  async function handleFactoryReset() {
    if (resetConfirmText !== 'RESET') return;
    setResetError('');
    setResetting(true);
    try {
      const res = await window.api.system.factoryReset();
      if (!res.success) {
        setResetting(false);
        setResetError(res.reason || 'Could not reset the app.');
      }
      // On success the main process relaunches the app itself — nothing more to do here.
    } catch {
      setResetting(false);
      setResetError('Could not reset the app.');
    }
  }

  if (user.role !== 'admin') return <RestrictedNotice />;

  if (restoredAwaitingRestart) return <RestoredCard onRestart={() => window.api.backup.relaunchApp()} />;

  return (
    <div style={settingsColumn}>
      <AutoBackupCard status={autoStatus} busy={autoBusy} onChangeFolder={changeAutoFolder} onBackupNow={backupNow} />
      <BackupCard exporting={exporting} onExport={handleExport} savedPath={savedPath} />
      <RestoreCard restoring={restoring} onRestore={handleRestore} error={error} />
      <DangerZone
        confirmText={resetConfirmText}
        onConfirmText={setResetConfirmText}
        resetting={resetting}
        onReset={handleFactoryReset}
        error={resetError}
      />
    </div>
  );
}
