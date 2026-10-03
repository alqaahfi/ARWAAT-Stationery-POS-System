import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { SettingsSkeleton, settingsColumn } from './parts/SettingsParts';
import { LicenseSections } from './parts/LicenseParts';

// Read-only — reactivation, if ever needed, is a separate out-of-scope flow.
export default function LicenseInfo() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    setLoadFailed(false);
    window.api.license
      .getStatus()
      .then(setStatus)
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user.role !== 'admin') return <RestrictedNotice />;
  if (loadFailed) return <LoadError message="License details couldn't be loaded." onRetry={load} />;
  if (!status) return <SettingsSkeleton cards={2} />;

  return (
    <div style={settingsColumn}>
      <LicenseSections status={status} />
    </div>
  );
}
