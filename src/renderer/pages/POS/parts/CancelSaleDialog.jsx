import React from 'react';
import { TriangleAlert } from 'lucide-react';
import theme from '../../../config/theme';
import { Button, IconTile, Kbd } from '../../../components/ui';
import { Scrim, c, keepFocus } from './common';

// Keys (Enter = cancel, Esc = keep working) stay in Sale.jsx's handler.
export default function CancelSaleDialog({ onKeep, onConfirm }) {
  return (
    <Scrim role="alertdialog" labelledBy="pos-cancel-title">
      <div style={styles.card}>
        <IconTile icon={TriangleAlert} color="red" size="lg" variant="soft" />
        <div id="pos-cancel-title" style={{ ...theme.type.title2, color: c.label, marginTop: theme.spacing.smd }}>
          Cancel this sale?
        </div>
        <div style={{ ...theme.type.body, color: c.labelSecondary, marginTop: '4px' }}>Everything you've entered will be cleared.</div>
        <div style={styles.actions} onMouseDown={keepFocus}>
          <Button variant="secondary" size="lg" fullWidth tabIndex={-1} onClick={onKeep}>
            Keep working <Kbd>Esc</Kbd>
          </Button>
          <Button variant="dangerFilled" size="lg" fullWidth tabIndex={-1} onClick={onConfirm}>
            Cancel sale <Kbd>Enter</Kbd>
          </Button>
        </div>
      </div>
    </Scrim>
  );
}

const styles = {
  card: {
    width: '360px',
    padding: theme.spacing.lg,
    boxSizing: 'border-box',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: theme.radius.xl,
    boxShadow: theme.shadow.modal,
  },
  actions: { display: 'flex', gap: theme.spacing.sm, width: '100%', marginTop: theme.spacing.lg },
};
