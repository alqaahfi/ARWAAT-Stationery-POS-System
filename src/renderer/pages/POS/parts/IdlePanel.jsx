import React from 'react';
import { History, ShoppingCart } from 'lucide-react';
import theme from '../../../config/theme';
import { Button, IconTile, Kbd } from '../../../components/ui';
import { c, keepFocus } from './common';

// idle: S starts a sale — unless a saved draft exists, then R / N decide.
export default function IdlePanel({ draftAvailable, draftItemCount, onStart, onResume, onStartNew }) {
  return (
    <div style={styles.wrap}>
      <IconTile icon={ShoppingCart} color="green" size="xl" variant="soft" />
      <div style={{ ...theme.type.title1, color: c.label, marginTop: theme.spacing.md }}>Ready for the next customer</div>

      {draftAvailable ? (
        <DraftBanner count={draftItemCount} onResume={onResume} onStartNew={onStartNew} />
      ) : (
        <>
          <div style={{ ...theme.type.body, color: c.labelSecondary, marginTop: '4px' }}>Start a sale whenever you're ready.</div>
          <Button size="lg" tabIndex={-1} onMouseDown={keepFocus} onClick={onStart} style={styles.startBtn}>
            Start new sale <Kbd>S</Kbd>
          </Button>
        </>
      )}
    </div>
  );
}

function DraftBanner({ count, onResume, onStartNew }) {
  return (
    <div style={styles.draft} role="status" aria-live="polite">
      <IconTile icon={History} color="orange" size="lg" variant="soft" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...theme.type.headline, color: c.label }}>You have an unfinished sale</div>
        {count > 0 && (
          <div style={{ ...theme.type.subhead, color: c.labelSecondary }}>
            {count} {count === 1 ? 'item' : 'items'} saved
          </div>
        )}
      </div>
      <Button variant="secondary" tabIndex={-1} onMouseDown={keepFocus} onClick={onStartNew}>
        Start new <Kbd>N</Kbd>
      </Button>
      <Button tabIndex={-1} onMouseDown={keepFocus} onClick={onResume}>
        Resume <Kbd>R</Kbd>
      </Button>
    </div>
  );
}

const styles = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: theme.spacing.lg },
  startBtn: { marginTop: theme.spacing.lg, height: '48px', padding: '0 24px', fontSize: '17px' },
  draft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.smd,
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    width: '100%',
    maxWidth: '520px',
    boxSizing: 'border-box',
    textAlign: 'left',
    borderRadius: theme.radius.lg,
    backgroundColor: c.surfaceAlt,
    border: `1px solid ${c.separator}`,
  },
};
