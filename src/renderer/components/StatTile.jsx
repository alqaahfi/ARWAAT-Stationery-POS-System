import React from 'react';
import theme from '../config/theme';

// label: sentence case, no trailing colon. value: pre-formatted, compact string.
// accent: one of theme.colors.accent{Blue,Green,Amber,Purple} — solid left
// border only, the card body itself always stays white (no colored fill).
export default function StatTile({ label, value, hint, accent, icon: Icon }) {
  return (
    <div style={{ ...styles.card, borderLeft: `4px solid ${accent || theme.colors.accentBlue}` }}>
      <div style={styles.top}>
        <div style={styles.label}>{label}</div>
        {Icon && <Icon size={22} strokeWidth={1.75} color={theme.colors.textSecondary} />}
      </div>
      <div style={styles.value}>{value}</div>
      {hint && <div style={styles.hint}>{hint}</div>}
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    padding: '16px 18px',
    fontFamily: theme.font.family,
    minWidth: 0,
  },
  top: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  label: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm },
  value: {
    fontSize: theme.font.sizeXl,
    fontWeight: theme.font.weightSemibold,
    color: theme.colors.textPrimary,
    marginTop: '8px',
    fontVariantNumeric: 'proportional-nums',
  },
  hint: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginTop: '6px' },
};
