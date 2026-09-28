import React from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import Sale from '../POS/Sale';
import theme from '../../config/theme';
import { APP_NAME } from '../../config/appInfo';
import { Card, EmptyState } from '../../components/ui';
import { Brand, SyncChip, UserChip } from '../../layout/ShellParts';

export default function Dashboard() {
  const { user, logout, hasPermission } = useAuth();

  if (user.role === 'admin') return <AdminDashboard />;

  // A cashier gets nothing but the POS screen — no sidebar, no other pages,
  // no tabs to switch between.
  const canSell = hasPermission('make_sale');

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Brand name={APP_NAME} />
        <div style={styles.right}>
          <SyncChip />
          <div style={styles.divider} />
          <UserChip user={user} onLogout={logout} style={{ width: '200px' }} />
        </div>
      </header>

      <main style={styles.content}>
        {canSell ? (
          <Sale />
        ) : (
          <Card padding="0">
            <EmptyState
              icon={Lock}
              color="gray"
              title="You can't make sales yet"
              message={'Ask your admin to turn on "Make Sales" for your account.'}
              style={{ padding: '56px 24px' }}
            />
          </Card>
        )}
      </main>
    </div>
  );
}

const c = theme.colors;

const styles = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: c.bg, color: c.label, fontFamily: theme.font.family },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: '0 20px 0 24px',
    height: '56px',
    minHeight: '56px',
    boxSizing: 'border-box',
    backgroundColor: c.surface,
    borderBottom: `1px solid ${c.separator}`,
    flexShrink: 0,
  },
  right: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd, flexShrink: 0 },
  divider: { width: '1px', height: '24px', backgroundColor: c.separator },
  content: { flex: 1, minHeight: 0, padding: '16px 24px', overflowY: 'auto' },
};
