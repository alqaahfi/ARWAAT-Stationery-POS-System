import React, { memo, useEffect, useState } from 'react';
import { LayoutGrid, List, Rows3 } from 'lucide-react';
import theme from '../../config/theme';
import { Avatar, Badge, SegmentedControl } from '../../components/ui';
import useInteraction from '../../components/kit/useInteraction';
import BalanceChip from '../../components/BalanceChip';
import { RowToggle } from './PartyParts';

const c = theme.colors;

// Same three views, same labels and same remembered choice as the Products page.
const VIEW_OPTIONS = [
  { value: 'list', label: 'List', icon: List },
  { value: 'grid', label: 'Cards', icon: LayoutGrid },
  { value: 'compact', label: 'Compact', icon: Rows3 },
];

export function usePartyViewMode(storageKey) {
  const [viewMode, setViewMode] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return VIEW_OPTIONS.some((o) => o.value === saved) ? saved : 'list';
    } catch {
      return 'list';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, viewMode);
    } catch {
      // Not remembered — the view still works.
    }
  }, [storageKey, viewMode]);
  return [viewMode, setViewMode];
}

export function PartyViewToggle({ value, onChange }) {
  return <SegmentedControl label="View" options={VIEW_OPTIONS} value={value} onChange={onChange} />;
}

// Cards view for a customer or supplier list.
//   party    'customer' | 'supplier' (colours the balance)
//   badges   (row) => node shown under the name
//   subline  (row) => text under the name
export function PartyCards({ rows, party, badges, subline, onOpen, onToggleActive }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: theme.spacing.md, alignItems: 'start' }}>
      {rows.map((row) => (
        <PartyCard key={row.id} row={row} party={party} badges={badges} subline={subline} onOpen={onOpen} onToggleActive={onToggleActive} />
      ))}
    </div>
  );
}

const PartyCard = memo(function PartyCard({ row, party, badges, subline, onOpen, onToggleActive }) {
  const { hovered, handlers } = useInteraction(false);
  const sub = subline?.(row);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(row);
        }
      }}
      {...handlers}
      style={{
        padding: theme.spacing.md,
        cursor: 'pointer',
        backgroundColor: hovered ? c.surfaceAlt : c.surface,
        border: `1px solid ${c.separator}`,
        borderRadius: theme.radius.lg,
        opacity: row.is_active ? 1 : 0.7,
        transition: `background-color ${theme.motion.fast} ease`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd }}>
        <Avatar name={row.name} size={40} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...theme.type.headline, color: c.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
          {sub && <div style={{ ...theme.type.footnote, color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: theme.spacing.smd, minHeight: '22px' }}>
        {badges?.(row)}
        {!row.is_active && <Badge size="sm">Inactive</Badge>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, marginTop: theme.spacing.smd }}>
        <BalanceChip amount={row.balance_owed} party={party} />
        <RowToggle checked={!!row.is_active} onChange={() => onToggleActive(row)} label={`${row.name} is active`} />
      </div>
    </div>
  );
});
