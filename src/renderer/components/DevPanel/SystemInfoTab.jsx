import React, { useEffect, useState } from 'react';
import theme from './devPanelTheme';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return 'unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SystemInfoTab() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    window.api.devpanel.getSystemInfo().then(setInfo);
  }, []);

  if (!info) {
    return <div style={{ color: theme.colors.panelTextSecondary, fontFamily: theme.font.mono, fontSize: theme.font.sizeSm }}>loading…</div>;
  }

  const rows = [
    ['App version', info.appVersion],
    ['Station code', info.stationCode || '—'],
    ['Machine ID', info.machineId || '—'],
    ['License', info.license.activated ? `activated — ${info.license.role} — ${info.license.shopName || '—'} (since ${info.license.activatedAt})` : 'not activated'],
    ['Database path', info.dbPath],
    ['Database size', formatBytes(info.dbSizeBytes)],
    ['Electron', info.electronVersion],
    ['Node', info.nodeVersion],
    ['Chrome', info.chromeVersion],
    ['Platform', info.platform],
    ['Hostname', info.hostname],
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', padding: '8px 0', borderBottom: `1px solid ${theme.colors.panelBorder}`, fontFamily: theme.font.mono, fontSize: theme.font.sizeSm }}>
          <div style={{ width: 180, flexShrink: 0, color: theme.colors.panelTextSecondary }}>{label}</div>
          <div style={{ color: theme.colors.panelText, wordBreak: 'break-all' }}>{value}</div>
        </div>
      ))}
    </div>
  );
}
