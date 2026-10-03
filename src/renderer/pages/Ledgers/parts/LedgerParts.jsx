import React from 'react';
import theme from '../../../config/theme';
import { Avatar, Card, FieldError, Skeleton } from '../../../components/ui';

const c = theme.colors;

// Every Accounts page: content column with room left for the Dev Panel icon.
export const ledgerPage = { display: 'flex', flexDirection: 'column', gap: theme.spacing.md, paddingBottom: theme.spacing.xxl };

// One plain sentence under the section tabs, with optional actions on the right.
export function PageIntro({ children, note, actions }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: theme.spacing.md }}>
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <p style={{ ...theme.type.body, color: c.labelSecondary, margin: 0 }}>{children}</p>
        {note && <p style={{ ...theme.type.footnote, color: c.labelSecondary, margin: '4px 0 0' }}>{note}</p>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

// Avatar + name for table cells.
export function PartyCell({ name, size = 28, badge }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 }}>
      <Avatar name={name || '?'} size={size} />
      <span style={{ ...theme.type.body, fontWeight: theme.font.weightMedium, color: c.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name || 'Unknown'}
      </span>
      {badge}
    </span>
  );
}

// Date on top, time as a footnote.
export function DateCell({ date, time }) {
  return (
    <span style={{ display: 'block', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'block', color: c.label }}>{date}</span>
      {time && <span style={{ display: 'block', ...theme.type.footnote, color: c.labelSecondary }}>{time}</span>}
    </span>
  );
}

// Field-level error that screen readers announce.
export function InlineError({ children }) {
  if (!children) return null;
  return (
    <div role="alert">
      <FieldError>{children}</FieldError>
    </div>
  );
}

// Stops clicks and keys on inner controls from reaching a clickable row.
export function RowControl({ children }) {
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      {children}
    </span>
  );
}

export function TableCard({ children }) {
  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      {children}
    </Card>
  );
}

export function Footnote({ children }) {
  return <div style={{ ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary }}>{children}</div>;
}

export function AccountSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <Card padding={theme.spacing.mdl}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <Skeleton width="56px" height="56px" radius={theme.radius.pill} />
          <div style={{ flex: 1 }}>
            <Skeleton width="40%" height="22px" />
            <Skeleton width="25%" height="12px" style={{ marginTop: '10px' }} />
          </div>
          <Skeleton width="140px" height="34px" />
        </div>
      </Card>
      <Card>
        <Skeleton lines={4} height="16px" />
      </Card>
    </div>
  );
}
