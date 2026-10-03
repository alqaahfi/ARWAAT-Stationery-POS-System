import React, { useId } from 'react';
import { Copy } from 'lucide-react';
import theme from '../../../config/theme';
import { Card, IconButton, ListRow, Skeleton, useToast } from '../../../components/ui';

const c = theme.colors;

// Shared page column for the Settings pages (the shell supplies the title
// and tabs). Leaves room at the bottom for the Dev Panel corner.
export const settingsColumn = {
  width: '100%',
  maxWidth: '760px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing.md,
  paddingBottom: '48px',
};

export const pageWrap = { minHeight: '100%', display: 'flex', flexDirection: 'column' };

export function PageIntro({ children }) {
  return <p style={{ ...theme.type.subhead, color: c.labelSecondary, margin: 0 }}>{children}</p>;
}

export function SettingsSkeleton({ cards = 2 }) {
  return (
    <div style={settingsColumn}>
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i}>
          <Skeleton width="30%" height="18px" style={{ marginBottom: theme.spacing.md }} />
          <Skeleton lines={3} />
        </Card>
      ))}
    </div>
  );
}

// A ListRow whose title is a real <label> for the control on the right.
// `control(id)` renders the control with that id.
export function SettingRow({ icon, color, title, subtitle, control, separator }) {
  const id = useId();
  return (
    <ListRow
      icon={icon}
      color={color}
      separator={separator}
      title={
        <label htmlFor={id} style={{ cursor: 'pointer' }}>
          {title}
        </label>
      }
      subtitle={subtitle}
      trailing={control(id)}
    />
  );
}

// Copy-to-clipboard icon button with a "Copied" toast.
export function CopyButton({ text, label = 'Copy' }) {
  const toast = useToast();
  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Couldn’t copy — select the text and copy it by hand.');
    }
  }
  return <IconButton icon={Copy} label={label} onClick={copy} disabled={!text} />;
}

// Big monospace code/ID block.
export function CodeText({ children, size = 'lg' }) {
  return (
    <div
      style={{
        fontFamily: theme.font.mono,
        fontSize: size === 'lg' ? theme.type.title2.fontSize : theme.type.footnote.fontSize,
        lineHeight: 1.4,
        letterSpacing: size === 'lg' ? '0.04em' : 0,
        color: c.label,
        wordBreak: 'break-all',
        userSelect: 'all',
      }}
    >
      {children}
    </div>
  );
}
