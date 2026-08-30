import React from 'react';
import theme from '../../config/theme';

export default function ChooseRole({ onChoose }) {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Stationery POS — First Time Setup</h1>
      <p style={styles.subtitle}>Is this PC the Admin PC or a Cashier PC?</p>
      <div style={styles.buttonRow}>
        <button style={styles.adminButton} onClick={() => onChoose('admin')}>
          Set Up Admin
        </button>
        <button style={styles.cashierButton} onClick={() => onChoose('cashier')}>
          Set Up Cashier
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.appBackground,
    color: theme.colors.textPrimary,
    fontFamily: theme.font.family,
    textAlign: 'center',
  },
  title: { fontSize: theme.font.sizeXl, fontWeight: theme.font.weightSemibold, marginBottom: '8px' },
  subtitle: { color: theme.colors.textSecondary, marginBottom: '32px' },
  buttonRow: { display: 'flex', gap: '20px' },
  adminButton: {
    padding: '16px 32px',
    fontSize: theme.font.sizeMd,
    borderRadius: theme.radius.md,
    border: '1px solid transparent',
    backgroundColor: theme.colors.primary,
    color: theme.colors.primaryText,
    cursor: 'pointer',
  },
  cashierButton: {
    padding: '16px 32px',
    fontSize: theme.font.sizeMd,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.borderStrong}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    cursor: 'pointer',
  },
};
