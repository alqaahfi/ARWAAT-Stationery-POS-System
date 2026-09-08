import React from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import Sale from '../POS/Sale';
import theme from '../../config/theme';
import { APP_NAME } from '../../config/appInfo';

export default function Dashboard() {
  const { user, logout, hasPermission } = useAuth();

  if (user.role === 'admin') return <AdminDashboard />;

  // A cashier gets nothing but the POS screen — no sidebar, no other pages,
  // no tabs to switch between. Record Payment / Sales Report / everything
  // else lives only in the admin sidebar now.
  const canSell = hasPermission('make_sale');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{APP_NAME}</h2>
          <div style={styles.subtitle}>{user.fullName}</div>
        </div>

        <button style={styles.logoutButton} onClick={logout}>
          Logout
        </button>
      </div>

      <div style={styles.content}>
        {canSell ? (
          <Sale />
        ) : (
          <div style={styles.accessDenied}>
            <h3 style={{ margin: 0 }}>You don't have access to the POS screen yet</h3>
            <p style={{ color: theme.colors.textSecondary }}>Ask your admin to grant you the "Make Sales" permission.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: theme.colors.appBackground, color: theme.colors.textPrimary, fontFamily: theme.font.family },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '0 28px',
    height: '56px',
    minHeight: '56px',
    backgroundColor: theme.colors.cardBackground,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  title: { fontSize: theme.font.sizeMd, fontWeight: theme.font.weightSemibold, margin: 0 },
  subtitle: { color: theme.colors.textSecondary, marginTop: '2px', fontSize: theme.font.sizeXs },
  logoutButton: {
    padding: '9px 16px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.borderStrong}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    cursor: 'pointer',
    fontSize: theme.font.sizeSm,
  },
  content: { flex: 1, minHeight: 0, padding: '16px 28px', overflowY: 'auto' },
  accessDenied: { padding: '40px' },
};
