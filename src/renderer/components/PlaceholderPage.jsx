import React from 'react';
import theme from '../config/theme';

// Stand-in for every nav destination that doesn't have a real screen yet, so
// the sidebar is fully wired end-to-end while each module gets built out.
export default function PlaceholderPage({ title }) {
  return (
    <div style={styles.card}>
      <div style={styles.icon}>🚧</div>
      <h3 style={styles.title}>{title}</h3>
      <p style={styles.subtitle}>This module hasn't been built yet — coming soon.</p>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    padding: '48px',
    textAlign: 'center',
    fontFamily: theme.font.family,
  },
  icon: { fontSize: '32px', marginBottom: '12px' },
  title: { color: theme.colors.textPrimary, fontSize: theme.font.sizeMd, margin: 0, fontWeight: theme.font.weightSemibold },
  subtitle: { color: theme.colors.textSecondary, fontSize: theme.font.sizeBase, marginTop: '8px' },
};
