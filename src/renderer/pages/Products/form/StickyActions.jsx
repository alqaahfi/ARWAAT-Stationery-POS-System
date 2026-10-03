import React from 'react';
import theme from '../../../config/theme';
import { Button } from '../../../components/ui';

const c = theme.colors;
const pad = theme.spacing.lg; // the content region's padding, cancelled so the bar spans edge to edge

// Save bar pinned to the bottom of the content area. Right padding keeps the
// buttons clear of the Dev Panel corner.
export function StickyActions({ onCancel, onSave, saving, saveLabel = 'Save product', cancelLabel = 'Cancel', saveDisabled = false, size }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: theme.spacing.sm,
        margin: `auto -${pad} -${pad}`,
        padding: `${theme.spacing.smd} 64px ${theme.spacing.smd} ${pad}`,
        backgroundColor: c.surface,
        borderTop: `1px solid ${c.separator}`,
      }}
    >
      <Button variant="plain" size={size} onClick={onCancel} disabled={saving}>
        {cancelLabel}
      </Button>
      <Button size={size} onClick={onSave} loading={saving} disabled={saveDisabled}>
        {saveLabel}
      </Button>
    </div>
  );
}
