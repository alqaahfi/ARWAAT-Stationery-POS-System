import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { PageIntro, SettingsSkeleton, settingsColumn } from './parts/SettingsParts';
import { ConnectionCodeCard, PeerList, StockWarningsCard, SyncLog, ThisComputerCard } from './parts/SyncParts';

const REFRESH_INTERVAL_MS = 5000;

export default function SyncAndPcs({ onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [peers, setPeers] = useState([]);
  const [log, setLog] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [secret, setSecret] = useState('');
  const [syncingPeer, setSyncingPeer] = useState(null); // machineId, or 'all'

  const loadAll = useCallback(() => {
    window.api.sync
      .getStatus()
      .then((s) => {
        setStatus(s);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
    window.api.sync.getPeers().then(setPeers).catch(() => {});
    window.api.sync.getLog().then(setLog).catch(() => {});
    window.api.sync.getReconciliationWarnings().then(setWarnings).catch(() => {});
    if (user.role === 'admin') window.api.sync.getSecret().then(setSecret).catch(() => {});
  }, [user.role]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadAll]);

  async function handleSyncNow(peerMachineId) {
    setSyncingPeer(peerMachineId || 'all');
    try {
      const results = await window.api.sync.triggerNow(peerMachineId ? { peerMachineId } : {});
      const failed = Array.isArray(results) ? results.find((r) => r && r.success === false) : null;
      if (failed) toast.error(failed.reason ? `Sync didn’t finish: ${failed.reason}` : 'Sync didn’t finish. Please try again.');
      else if (Array.isArray(results) && results.length === 0) toast.info('No other computers to sync with right now');
      else toast.success('Sync finished');
    } catch {
      toast.error('Sync didn’t finish. Please try again.');
    } finally {
      loadAll();
      setSyncingPeer(null);
    }
  }

  if (user.role !== 'admin') return <RestrictedNotice />;
  if (!status && loadFailed) return <LoadError message="Connected Computers couldn't be loaded." onRetry={loadAll} />;
  if (!status) return <SettingsSkeleton cards={3} />;

  return (
    <div style={settingsColumn}>
      <PageIntro>Other computers connected to this shop, and when they last synced.</PageIntro>
      <ConnectionCodeCard code={secret} />
      <ThisComputerCard status={status} syncingAll={syncingPeer === 'all'} syncDisabled={syncingPeer !== null && syncingPeer !== 'all'} onSyncAll={() => handleSyncNow(null)} />
      <StockWarningsCard
        warnings={warnings}
        onFix={onNavigate ? (w) => onNavigate('/products/stock-adjustments', { productId: w.productId }) : undefined}
      />
      <PeerList peers={peers} syncingPeer={syncingPeer} onSync={handleSyncNow} />
      <SyncLog log={log} />
    </div>
  );
}
