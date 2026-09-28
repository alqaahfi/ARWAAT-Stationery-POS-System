import React from 'react';
import { ChevronRight } from 'lucide-react';
import theme from '../../../config/theme';
import { Icon, IconTile } from '../../../components/ui';
import useInteraction from '../../../components/kit/useInteraction';

const c = theme.colors;

// White card with a headline title, optional right-side node, and a body.
// flush: body has no padding (for edge-to-edge rows).
export function Panel({ title, right, flush = false, children, style }) {
  return (
    <section style={{ ...styles.panel, ...style }}>
      {(title || right) && (
        <div style={styles.header}>
          {title && <h2 style={styles.title}>{title}</h2>}
          {right}
        </div>
      )}
      <div style={flush ? null : styles.body}>{children}</div>
    </section>
  );
}

// A real <button> row: soft icon tile + title/subtitle + chevron.
// `separator` is injected by ListSection (and by Panel lists below).
export function NavRow({ icon, color = 'gray', title, subtitle, onClick, separator }) {
  const { hovered, pressed, handlers } = useInteraction(false);
  return (
    <button
      type="button"
      onClick={onClick}
      {...handlers}
      style={{ ...styles.row, backgroundColor: pressed ? c.fill : hovered ? c.surfaceAlt : c.surface }}
    >
      {separator && <span aria-hidden="true" style={styles.separator} />}
      <IconTile icon={icon} color={color} size="md" variant="soft" />
      <span style={styles.rowText}>
        <span style={styles.rowTitle}>{title}</span>
        {subtitle && <span style={styles.rowSubtitle}>{subtitle}</span>}
      </span>
      <Icon icon={ChevronRight} size={16} style={{ color: c.labelTertiary }} />
    </button>
  );
}

// Adds a separator above every row after the first.
export function RowList({ children }) {
  const rows = React.Children.toArray(children).filter(React.isValidElement);
  return <div>{rows.map((row, i) => React.cloneElement(row, { separator: i > 0 }))}</div>;
}

const styles = {
  panel: {
    backgroundColor: c.surface,
    border: `1px solid ${c.separator}`,
    borderRadius: theme.radius.lg,
    fontFamily: theme.font.family,
    overflow: 'hidden',
    minWidth: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: `14px ${theme.spacing.md} ${theme.spacing.sm}`,
  },
  title: { ...theme.type.headline, color: c.label, margin: 0 },
  body: { padding: `${theme.spacing.xs} ${theme.spacing.md} ${theme.spacing.md}` },
  row: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.smd,
    width: '100%',
    minHeight: theme.control.row,
    padding: `6px ${theme.spacing.md}`,
    boxSizing: 'border-box',
    border: 'none',
    fontFamily: theme.font.family,
    textAlign: 'left',
    cursor: 'pointer',
    outlineOffset: '-3px',
    transition: `background-color ${theme.motion.fast} ease`,
  },
  separator: { position: 'absolute', top: 0, left: '58px', right: 0, height: '1px', backgroundColor: c.separator },
  rowText: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  rowTitle: { ...theme.type.body, color: c.label },
  rowSubtitle: { ...theme.type.footnote, color: c.labelSecondary, marginTop: '1px' },
};
