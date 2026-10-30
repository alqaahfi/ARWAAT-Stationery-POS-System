import React from 'react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import { IconTile, Skeleton } from '../../../components/ui';
import useAlerts, { ALERT_TYPES } from '../../../layout/useAlerts';
import { NavRow, Panel, RowList } from './Panel';

const c = theme.colors;

// Plain-words title/subtitle per alert key (counts come from the shared hook).
const WORDING = {
  low: (n) => ({ title: n === 1 ? '1 item is running low' : `${n} items are running low`, subtitle: 'Reorder before they run out' }),
  dead: (n) => ({ title: n === 1 ? '1 item is not selling' : `${n} items are not selling`, subtitle: 'No sales in a long while' }),
  overdue: (n) => ({
    title: n === 1 ? '1 customer is overdue' : `${n} customers are overdue`,
    subtitle: 'Owing for more than 90 days',
  }),
  review: (n) => ({
    title: n === 1 ? '1 item needs review' : `${n} items need review`,
    subtitle: 'Added at the counter — set buying price and approve',
  }),
  recount: (n) => ({
    title: n === 1 ? '1 item needs a stock recount' : `${n} items need a stock recount`,
    subtitle: 'Sold without enough stock or below zero',
  }),
};

export default function NeedsAttentionCard({ onNavigate }) {
  const counts = useAlerts();
  const rows = ALERT_TYPES.filter((a) => counts[a.key] > 0 && WORDING[a.key]);

  let body;
  if (!counts.loaded) {
    body = (
      <div style={{ padding: theme.spacing.md }}>
        <Skeleton lines={3} height="30px" />
      </div>
    );
  } else if (!rows.length) {
    body = (
      <div style={styles.clear}>
        <IconTile {...appIcons.check} size="md" variant="soft" />
        <span style={styles.clearText}>You're all caught up</span>
      </div>
    );
  } else {
    body = (
      <RowList>
        {rows.map((a) => (
          <NavRow key={a.key} icon={a.icon} color={a.color} {...WORDING[a.key](counts[a.key])} onClick={() => onNavigate(a.route)} />
        ))}
      </RowList>
    );
  }

  return (
    <Panel title="Needs attention" flush>
      {body}
    </Panel>
  );
}

const styles = {
  clear: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd, padding: `6px ${theme.spacing.md} 14px` },
  clearText: { ...theme.type.body, color: c.label },
};
