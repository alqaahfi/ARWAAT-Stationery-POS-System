import React from 'react';
import { HardDrive, TriangleAlert } from 'lucide-react';
import theme from '../../../config/theme';
import { Button, IconTile } from '../../../components/ui';
import { Panel } from './Panel';

const c = theme.colors;

// Rule 16 on Home: a failed automatic backup, and the weekly reminder to copy
// a backup to a USB drive (with the folder where the backups are).
export default function BackupNotice({ status, onDone, onOpenSettings }) {
  if (!status) return null;
  const failed = !!status.lastError;
  if (!failed && !status.usbReminderDue) return null;
  return (
    <Panel>
      {failed && (
        <div role="alert" style={{ ...styles.row, marginBottom: status.usbReminderDue ? theme.spacing.md : 0 }}>
          <IconTile icon={TriangleAlert} color="red" variant="soft" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...theme.type.headline, color: c.redText }}>The automatic backup failed</div>
            <div style={styles.sub}>{status.lastError}</div>
          </div>
          <Button variant="tinted" size="sm" onClick={onOpenSettings}>
            Open Backup
          </Button>
        </div>
      )}
      {status.usbReminderDue && (
        <div style={styles.row}>
          <IconTile icon={HardDrive} color="indigo" variant="soft" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...theme.type.headline, color: c.label }}>Copy a backup to a USB drive</div>
            <div style={styles.sub}>
              Your daily backups are in {status.folder}. Copy the newest file to a USB drive and keep it away from this
              computer.
            </div>
          </div>
          <Button size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      )}
    </Panel>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd },
  sub: { ...theme.type.footnote, color: c.labelSecondary, overflowWrap: 'anywhere', marginTop: '2px' },
};
