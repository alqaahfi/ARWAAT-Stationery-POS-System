import React from 'react';
import { Check } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Icon } from '../../../components/ui';
import { Panel } from './Panel';

const c = theme.colors;

// Shown only while a brand-new shop still has a first step left to do.
export default function GettingStartedCard({ summary, onNavigate }) {
  const steps = [
    {
      key: 'product',
      title: 'Add your first product',
      done: Number(summary.totalProducts) > 0,
      action: glossary.addProduct,
      route: '/products/new',
    },
    {
      key: 'sale',
      title: 'Make your first sale',
      done: (summary.recentSales || []).length > 0,
      action: glossary.newSale,
      route: '/pos',
    },
  ];
  if (steps.every((s) => s.done)) return null;

  return (
    <Panel title="Let's get your shop ready" flush>
      {steps.map((s, i) => (
        <div key={s.key} style={{ ...styles.row, borderTop: i > 0 ? `1px solid ${c.separator}` : 'none' }}>
          <span
            aria-hidden="true"
            style={{
              ...styles.circle,
              backgroundColor: s.done ? c.green : 'transparent',
              borderColor: s.done ? c.green : c.separatorStrong,
            }}
          >
            {s.done && <Icon icon={Check} size={16} style={{ color: c.labelOnAccent }} />}
          </span>
          <span style={{ ...styles.title, color: s.done ? c.labelSecondary : c.label }}>
            {s.title}
            {s.done && <span style={styles.srOnly}> (done)</span>}
          </span>
          {!s.done && (
            <Button size="sm" onClick={() => onNavigate(s.route)}>
              {s.action}
            </Button>
          )}
        </div>
      ))}
    </Panel>
  );
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.smd,
    minHeight: theme.control.row,
    padding: `6px ${theme.spacing.md}`,
  },
  circle: {
    width: '22px',
    height: '22px',
    boxSizing: 'border-box',
    borderRadius: theme.radius.pill,
    border: '2px solid',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { ...theme.type.body, flex: 1, minWidth: 0 },
  srOnly: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' },
};
