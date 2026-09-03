import React, { useEffect, useState } from 'react';
import theme from './devPanelTheme';
import AuditLogTab from './AuditLogTab';
import DatabaseBrowserTab from './DatabaseBrowserTab';
import UsersSessionsTab from './UsersSessionsTab';
import SystemInfoTab from './SystemInfoTab';
import AccessLogTab from './AccessLogTab';

const TABS = [
  { key: 'audit', label: 'Audit Log', Component: AuditLogTab },
  { key: 'database', label: 'Database Browser', Component: DatabaseBrowserTab },
  { key: 'users', label: 'Users & Sessions', Component: UsersSessionsTab },
  { key: 'system', label: 'System Info', Component: SystemInfoTab },
  { key: 'access', label: 'Access Log', Component: AccessLogTab },
];

// Full-screen diagnostic overlay — a layer over whatever screen was active,
// not a route in the normal router (see DevPanelTrigger.jsx). Read-only:
// nothing under here calls a write IPC channel.
export default function DevPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('audit');

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const ActiveComponent = TABS.find((t) => t.key === activeTab).Component;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        backgroundColor: theme.colors.panelBackground,
        color: theme.colors.panelText,
        fontFamily: theme.font.mono,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          borderBottom: `1px solid ${theme.colors.panelBorder}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.lg }}>
          <span style={{ fontWeight: theme.font.weightSemibold, fontSize: theme.font.sizeMd }}>Dev Panel</span>
          <div style={{ display: 'flex', gap: theme.spacing.xs }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: theme.radius.sm,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: theme.font.mono,
                  fontSize: theme.font.sizeSm,
                  backgroundColor: activeTab === tab.key ? theme.colors.primary : 'transparent',
                  color: activeTab === tab.key ? theme.colors.primaryText : theme.colors.panelTextSecondary,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '6px 14px',
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.panelBorder}`,
            backgroundColor: 'transparent',
            color: theme.colors.panelText,
            fontFamily: theme.font.mono,
            fontSize: theme.font.sizeSm,
            cursor: 'pointer',
          }}
        >
          Close (Esc)
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: theme.spacing.md }}>
        <ActiveComponent />
      </div>
    </div>
  );
}
