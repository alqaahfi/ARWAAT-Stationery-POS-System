import React from 'react';
import theme from '../../../config/theme';
import { IconTile, Skeleton } from '../../../components/ui';
import useInteraction from '../../../components/kit/useInteraction';

const c = theme.colors;

// One big clickable card: icon + label, a large value, and a footnote line.
// footnoteColor: optional token for the footnote (e.g. orangeText for warnings).
export default function StatTile({ icon, color, label, value, footnote, footnoteColor, loading, onClick }) {
  const { hovered, pressed, handlers } = useInteraction(false);
  return (
    <button
      type="button"
      onClick={onClick}
      {...handlers}
      style={{
        ...styles.tile,
        borderColor: hovered ? c.separatorStrong : c.separator,
        transform: pressed ? 'scale(0.99)' : 'none',
      }}
    >
      <span style={styles.top}>
        <IconTile icon={icon} color={color} size="md" />
        <span style={styles.label}>{label}</span>
      </span>
      {loading ? (
        <>
          <Skeleton width="60%" height="30px" style={{ margin: '10px 0 6px' }} />
          <Skeleton width="40%" height="12px" />
        </>
      ) : (
        <>
          <span style={styles.value}>{value}</span>
          <span style={{ ...styles.footnote, color: footnoteColor || c.labelSecondary }}>{footnote}</span>
        </>
      )}
    </button>
  );
}

const styles = {
  tile: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    minWidth: 0,
    padding: theme.spacing.md,
    boxSizing: 'border-box',
    backgroundColor: c.surface,
    border: '1px solid',
    borderRadius: theme.radius.lg,
    fontFamily: theme.font.family,
    textAlign: 'left',
    cursor: 'pointer',
    transition: `border-color ${theme.motion.fast} ease, transform ${theme.motion.fast} ease`,
  },
  top: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 },
  label: { ...theme.type.subhead, color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  value: {
    fontSize: '30px',
    fontWeight: theme.font.weightBold,
    lineHeight: '36px',
    letterSpacing: '-0.02em',
    color: c.label,
    ...theme.font.numeric,
    margin: '10px 0 2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  footnote: { ...theme.type.footnote },
};
