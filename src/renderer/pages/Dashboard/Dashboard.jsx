import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import Sale from '../POS/Sale';
import RecordPayment from '../Payments/RecordPayment';
import SalesReport from '../Reports/SalesReport';
import theme from '../../config/theme';

export default function Dashboard({ shopName }) {
  const { user, logout, hasPermission } = useAuth();

  if (user.role === 'admin') return <AdminDashboard shopName={shopName} />;

  // Cashier PCs don't have the full admin sidebar yet — Cashier Mode, Record
  // Payment and (if granted) Sales Report are the only screens a cashier
  // needs today, switched with a couple of tabs in the topbar rather than a
  // full nav shell.
  const tabs = [
    hasPermission('make_sale') && { key: 'sale', label: 'Cashier Mode' },
    hasPermission('record_payment') && { key: 'record-payment', label: 'Record Payment' },
    hasPermission('view_reports') && { key: 'sales-report', label: 'Sales Report' },
  ].filter(Boolean);

  const [activeTab, setActiveTab] = useState(tabs[0]?.key || null);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>{shopName || 'Stationery POS'}</h2>
          <div style={styles.subtitle}>
            {user.fullName} · <span style={{ textTransform: 'capitalize' }}>{user.role}</span>
          </div>
        </div>

        {tabs.length > 1 && (
          <div style={styles.tabs}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                style={{ ...styles.tabButton, ...(activeTab === tab.key ? styles.tabButtonActive : {}) }}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <button style={styles.logoutButton} onClick={logout}>
          Logout
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'sale' && <Sale />}
        {activeTab === 'record-payment' && <RecordPayment />}
        {activeTab === 'sales-report' && <SalesReport />}
        {!activeTab && (
          <div style={styles.accessDenied}>
            <h3 style={{ margin: 0 }}>You don't have access to any screen yet</h3>
            <p style={{ color: theme.colors.textSecondary }}>Ask your admin to grant you a permission such as "make sale".</p>
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
  tabs: { display: 'flex', gap: '6px', flex: 1, justifyContent: 'center' },
  tabButton: {
    padding: '8px 16px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    fontSize: theme.font.sizeSm,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    color: theme.colors.primaryText,
  },
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
