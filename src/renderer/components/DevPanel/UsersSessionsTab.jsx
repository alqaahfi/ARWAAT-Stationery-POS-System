import React, { useEffect, useState } from 'react';
import theme from './devPanelTheme';
import { DataTable } from './shared';

const USER_COLUMNS = ['id', 'full_name', 'username', 'role', 'is_active', 'password_hash', 'last_login_at', 'created_at'];
const SESSION_COLUMNS = ['id', 'user_id', 'full_name', 'username', 'role', 'station_code', 'token', 'created_at', 'expires_at', 'ended_at', 'is_revoked'];

export default function UsersSessionsTab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    window.api.devpanel.getUsersSessions().then(setData);
  }, []);

  if (!data) return <Loading />;

  return (
    <div>
      <SectionTitle>Users — this PC ({data.stationCode || 'unknown station'})</SectionTitle>
      <DataTable columns={USER_COLUMNS} rows={data.users} emptyLabel="No users." />

      <SectionTitle style={{ marginTop: theme.spacing.lg }}>Sessions</SectionTitle>
      <DataTable columns={SESSION_COLUMNS} rows={data.sessions} emptyLabel="No sessions." />
    </div>
  );
}

function SectionTitle({ children, style }) {
  return (
    <div style={{ color: theme.colors.panelTextSecondary, fontFamily: theme.font.mono, fontSize: theme.font.sizeSm, marginBottom: theme.spacing.xs, ...style }}>
      {children}
    </div>
  );
}

function Loading() {
  return <div style={{ color: theme.colors.panelTextSecondary, fontFamily: theme.font.mono, fontSize: theme.font.sizeSm }}>loading…</div>;
}
