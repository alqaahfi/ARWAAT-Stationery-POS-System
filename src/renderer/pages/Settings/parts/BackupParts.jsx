import React, { useId } from 'react';
import { CircleCheck, DatabaseBackup, FolderOpen, RotateCcw, TriangleAlert } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Banner, Button, Card, EmptyState, IconTile, TextInput } from '../../../components/ui';

const c = theme.colors;

function CardHead({ icon, color, title, children }) {
  return (
    <div style={{ display: 'flex', gap: theme.spacing.smd, marginBottom: theme.spacing.md }}>
      <IconTile icon={icon} color={color} size="lg" variant="soft" />
      <div style={{ minWidth: 0 }}>
        <h2 style={{ ...theme.type.headline, color: c.label, margin: 0 }}>{title}</h2>
        <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>{children}</div>
      </div>
    </div>
  );
}

export function BackupCard({ exporting, onExport, savedPath }) {
  return (
    <Card>
      <CardHead icon={DatabaseBackup} color="indigo" title="Back up your shop">
        Saves a copy of everything — products, sales, customers, accounts — to a file you choose, like a USB drive.
      </CardHead>
      <Button onClick={onExport} loading={exporting}>
        {glossary.createBackup}
      </Button>
      {savedPath && (
        <div role="status" style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: theme.spacing.sm, overflowWrap: 'anywhere' }}>
          Last saved to {savedPath}
        </div>
      )}
    </Card>
  );
}

export function RestoreCard({ restoring, onRestore, error }) {
  return (
    <Card>
      <CardHead icon={RotateCcw} color="orange" title={glossary.restoreBackup}>
        Replaces everything on this computer with a backup file you made earlier. The app restarts afterwards.
      </CardHead>
      <Button variant="secondary" icon={FolderOpen} onClick={onRestore} loading={restoring}>
        Choose a backup file
      </Button>
      <Banner>{error}</Banner>
    </Card>
  );
}

export function RestoredCard({ onRestart }) {
  return (
    <Card style={{ maxWidth: '520px', margin: '0 auto' }}>
      <EmptyState
        icon={CircleCheck}
        color="green"
        title="Backup restored"
        message="The app needs to restart to load the restored data."
        action={<Button onClick={onRestart}>Restart now</Button>}
      />
    </Card>
  );
}

// Visually separate, red-edged. The typed RESET stays — the button is
// disabled until it matches exactly.
export function DangerZone({ confirmText, onConfirmText, resetting, onReset, error }) {
  const inputId = useId();
  const armed = confirmText === 'RESET';
  return (
    <section
      aria-labelledby={`${inputId}-title`}
      style={{
        marginTop: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        border: `1px solid ${c.redTintStrong}`,
        borderLeft: `4px solid ${c.red}`,
        backgroundColor: c.redTint,
      }}
    >
      <div style={{ ...theme.type.footnote, fontWeight: theme.font.weightSemibold, textTransform: 'uppercase', letterSpacing: '0.04em', color: c.redText, marginBottom: theme.spacing.smd }}>
        {glossary.dangerZone}
      </div>
      <div style={{ display: 'flex', gap: theme.spacing.smd }}>
        <IconTile icon={TriangleAlert} color="red" size="lg" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 id={`${inputId}-title`} style={{ ...theme.type.headline, color: c.redText, margin: 0 }}>
            {glossary.eraseEverything}
          </h2>
          <p style={{ ...theme.type.subhead, color: c.label, margin: '4px 0 0' }}>
            Wipes all sales, products, customers, suppliers, users and other shop data on this computer, and removes its
            activation — the app goes back to the Setup screen and needs a new activation key. This can’t be undone. Make a
            backup first if there’s any chance you’ll need this data again.
          </p>

          <label htmlFor={inputId} style={{ display: 'block', ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, margin: `${theme.spacing.md} 0 6px` }}>
            Type RESET to unlock the button
          </label>
          <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextInput
              id={inputId}
              value={confirmText}
              onChange={(e) => onConfirmText(e.target.value)}
              placeholder="RESET"
              autoComplete="off"
              spellCheck={false}
              style={{ width: '200px', fontFamily: theme.font.mono, borderColor: c.red }}
            />
            <Button variant="dangerFilled" onClick={onReset} disabled={!armed} loading={resetting}>
              {glossary.eraseEverything}
            </Button>
          </div>
          <Banner>{error}</Banner>
        </div>
      </div>
    </section>
  );
}
