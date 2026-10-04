import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import theme from '../../../config/theme';
import useInteraction from '../../../components/kit/useInteraction';

const c = theme.colors;

function Crumb({ label, onClick, back }) {
  const { hovered, handlers } = useInteraction(false);
  return (
    <button
      type="button"
      onClick={onClick}
      {...handlers}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing.xs,
        height: theme.control.sm,
        padding: `0 ${theme.spacing.sm}`,
        border: 'none',
        borderRadius: theme.radius.sm,
        cursor: 'pointer',
        fontFamily: 'inherit',
        ...theme.type.subhead,
        fontWeight: theme.font.weightMedium,
        color: c.accent,
        backgroundColor: hovered ? c.accentTint : 'transparent',
        transition: `background-color ${theme.motion.fast} ease`,
      }}
    >
      {back && <ChevronLeft size={16} aria-hidden="true" />}
      {label}
    </button>
  );
}

// Back button + breadcrumb for the Ledgers pages below the landing page.
//   crumbs  [{ label, onClick }] — each is a link back up the tree
//   current the title of the page the user is on (not clickable)
export function LedgerBackBar({ crumbs, current }) {
  const last = crumbs[crumbs.length - 1];
  return (
    <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing.xxs }}>
      <Crumb label={`Back to ${last.label}`} onClick={last.onClick} back />
      <span aria-hidden="true" style={{ width: '1px', height: '16px', backgroundColor: c.separator, margin: `0 ${theme.spacing.sm}` }} />
      {crumbs.map((crumb) => (
        <React.Fragment key={crumb.label}>
          <Crumb label={crumb.label} onClick={crumb.onClick} />
          <ChevronRight size={14} color={c.labelTertiary} aria-hidden="true" />
        </React.Fragment>
      ))}
      <span aria-current="page" style={{ ...theme.type.subhead, fontWeight: theme.font.weightSemibold, color: c.label, padding: `0 ${theme.spacing.sm}` }}>
        {current}
      </span>
    </nav>
  );
}
