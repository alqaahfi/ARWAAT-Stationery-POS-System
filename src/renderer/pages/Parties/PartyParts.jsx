import React, { memo, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, CircleAlert, Lock, RotateCw, SearchX } from 'lucide-react';
import theme from '../../config/theme';
import { Avatar, Badge, Button, Card, EmptyState, Icon, Skeleton, Toggle } from '../../components/ui';

const c = theme.colors;

// "Couldn't load" state with a retry button.
export function LoadError({ message = 'Something went wrong while loading.', onRetry }) {
  return (
    <EmptyState
      icon={CircleAlert}
      color="red"
      title="Couldn't load this"
      message={message}
      action={
        onRetry && (
          <Button variant="tinted" icon={RotateCw} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}

export function NoMatch({ what, onClear }) {
  return (
    <EmptyState
      icon={SearchX}
      title={`No ${what} match`}
      message="Try a different name or phone number, or clear the filters."
      action={
        <Button variant="tinted" onClick={onClear}>
          Clear filters
        </Button>
      }
    />
  );
}

export function RestrictedNotice() {
  return (
    <Card style={{ maxWidth: '560px', margin: '0 auto' }}>
      <EmptyState icon={Lock} title="Only the owner can open this" message="This section is limited to Admin accounts." />
    </Card>
  );
}

// Avatar + name + one line underneath. Muted when the record is inactive.
export const PartyNameCell = memo(function PartyNameCell({ name, sub, inactive }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd, minHeight: '34px', opacity: inactive ? 0.6 : 1 }}>
      <Avatar name={name} size={36} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <span style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label }}>{name}</span>
          {inactive && <Badge size="sm">Inactive</Badge>}
        </div>
        {sub && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{sub}</div>}
      </div>
    </div>
  );
});

// Toggle inside a clickable row: clicks and keys never reach the row.
export function RowToggle({ checked, onChange, label }) {
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </span>
  );
}

export function RowChevron() {
  return <Icon icon={ChevronRight} size={16} style={{ color: c.labelTertiary, verticalAlign: 'middle' }} />;
}

// Footnote under a list toolbar.
export function ListSummary({ children }) {
  return <div style={{ ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, margin: `${theme.spacing.smd} 0` }}>{children}</div>;
}

// Label + hint on the left, switch on the right.
export function OptionRow({ label, hint, checked, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, padding: `${theme.spacing.sm} 0` }}>
      <div style={{ flex: 1 }}>
        <label htmlFor={id} style={{ ...theme.type.body, color: c.label, cursor: 'pointer' }}>
          {label}
        </label>
        {hint && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{hint}</div>}
      </div>
      <Toggle id={id} checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div style={pageColumn}>
      {[2, 4, 2].map((lines, i) => (
        <Card key={i}>
          <Skeleton width="30%" height="18px" style={{ marginBottom: theme.spacing.md }} />
          <Skeleton lines={lines} />
        </Card>
      ))}
    </div>
  );
}

// Page layout shared by the two profile/form pages.
export const pageWrap = { minHeight: '100%', display: 'flex', flexDirection: 'column' };
export const pageColumn = {
  width: '100%',
  maxWidth: '860px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing.md,
  paddingBottom: theme.spacing.xxl,
};

// --- Fixed one-screen form ------------------------------------------------
// The content region scrolls and has tabs above the page, so a plain 100%
// height overflows. Measure the room left and fill exactly that.
export function useFitHeight() {
  const ref = useRef(null);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    function fit() {
      if (!ref.current) return;
      const top = ref.current.getBoundingClientRect().top;
      setHeight(Math.max(320, window.innerHeight - top - parseInt(theme.spacing.lg, 10)));
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return [ref, height];
}

export const fixedPage = (height) => ({ height: height ?? '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: theme.spacing.smd });
// One surface holding every field; clips so nothing ever scrolls.
export const formBox = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  boxSizing: 'border-box',
  backgroundColor: c.surface,
  border: `1px solid ${c.separator}`,
  borderRadius: theme.radius.lg,
  padding: `${theme.spacing.smd} ${theme.spacing.mdl}`,
};
export const formColumns = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: theme.spacing.xl, alignItems: 'start' };
export const formDivider = { height: '1px', backgroundColor: c.separator, margin: `${theme.spacing.xs} 0 ${theme.spacing.smd}` };

// Label on the left, control on the right — one line per field.
export function FormRow({ label, required, error, hint, top, children }) {
  const autoId = useId();
  const child = React.Children.only(children);
  const id = child.props.id || autoId;
  const control = React.cloneElement(child, {
    id,
    'aria-invalid': error ? true : child.props['aria-invalid'],
    'aria-describedby': error || hint ? `${id}-msg` : undefined,
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr)', columnGap: theme.spacing.smd, alignItems: top ? 'start' : 'center', marginBottom: theme.spacing.sm }}>
      <label htmlFor={id} style={{ ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.labelSecondary, paddingTop: top ? '8px' : 0 }}>
        {label}
        {required && <span style={{ color: c.redText }}> *</span>}
      </label>
      <div style={{ minWidth: 0 }}>
        {control}
        {(error || hint) && (
          <div id={`${id}-msg`} role={error ? 'alert' : undefined} style={{ ...theme.type.footnote, color: error ? c.redText : c.labelSecondary, marginTop: '2px' }}>
            {error || hint}
          </div>
        )}
      </div>
    </div>
  );
}

export const listToolbar = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm };
