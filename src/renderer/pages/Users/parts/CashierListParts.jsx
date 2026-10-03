import React from 'react';
import { ArrowDown, ArrowUp, KeyRound, Plus, SearchX, UserCog } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Button, EmptyState, IconButton, SearchField, Select } from '../../../components/ui';
import { PartyNameCell, RowChevron, RowToggle, listToolbar } from '../../Parties/PartyParts';
import { StatusBadge, permissionSummary } from './CashierFormParts';

const c = theme.colors;

export const SORT_OPTIONS = [
  { key: 'full_name', label: 'Name' },
  { key: 'username', label: 'Username' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Date added' },
];

export function CashierToolbar({ search, onSearch, sortBy, onSortBy, sortDirection, onToggleDirection, onAdd }) {
  return (
    <div style={listToolbar}>
      <SearchField
        value={search}
        onChange={onSearch}
        placeholder="Search by name"
        aria-label="Search cashiers"
        style={{ flex: '1 1 220px', maxWidth: '420px' }}
      />
      <Select aria-label="Sort by" value={sortBy} onChange={(e) => onSortBy(e.target.value)} style={{ width: '170px' }}>
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            Sort: {opt.label}
          </option>
        ))}
      </Select>
      <IconButton
        icon={sortDirection === 'asc' ? ArrowUp : ArrowDown}
        label={sortDirection === 'asc' ? 'Sorted A to Z — click to reverse' : 'Sorted Z to A — click to reverse'}
        onClick={onToggleDirection}
      />
      <Button icon={Plus} onClick={onAdd} style={{ marginLeft: 'auto' }}>
        {glossary.addCashier}
      </Button>
    </div>
  );
}

// Clicks inside a clickable row that must not open the row.
function StopRow({ children }) {
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      {children}
    </span>
  );
}

function PermissionsCell({ values, definitions }) {
  if (!values) return <span style={{ color: c.labelTertiary }}>—</span>;
  const { count, lines } = permissionSummary(definitions, values);
  if (count === 0) return <Badge>No permissions</Badge>;
  return (
    <span title={lines.join('\n')}>
      <Badge tone="blue">
        {count} permission{count === 1 ? '' : 's'}
      </Badge>
    </span>
  );
}

export function cashierColumns({ permsById, definitions, onToggleActive, onResetPassword }) {
  return [
    {
      key: 'name',
      label: glossary.cashier,
      render: (r) => <PartyNameCell name={r.full_name} inactive={!r.is_active} />,
    },
    {
      key: 'username',
      label: 'Username',
      width: '180px',
      render: (r) => <span style={{ ...theme.type.footnote, fontFamily: theme.font.mono, color: c.labelSecondary }}>{r.username}</span>,
    },
    {
      key: 'perms',
      label: 'Permissions',
      width: '160px',
      render: (r) => <PermissionsCell values={permsById[r.id]} definitions={definitions} />,
    },
    { key: 'status', label: 'Status', width: '110px', render: (r) => <StatusBadge active={!!r.is_active} /> },
    {
      key: 'actions',
      label: '',
      width: '110px',
      align: 'right',
      render: (r) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <StopRow>
            <IconButton icon={KeyRound} size="sm" label={`${glossary.resetPassword} for ${r.full_name}`} onClick={() => onResetPassword(r)} />
          </StopRow>
          <RowToggle checked={!!r.is_active} onChange={() => onToggleActive(r)} label={`${r.full_name} can log in`} />
        </div>
      ),
    },
    { key: 'go', label: '', width: '32px', align: 'right', render: () => <RowChevron /> },
  ];
}

export function NoCashiers({ onAdd }) {
  return (
    <EmptyState
      icon={UserCog}
      color="teal"
      title="Add your first cashier"
      message="Cashiers can make sales and do the other things you allow them to."
      action={
        <Button icon={Plus} onClick={onAdd}>
          {glossary.addCashier}
        </Button>
      }
    />
  );
}

export function NoCashierMatch({ onClear }) {
  return (
    <EmptyState
      icon={SearchX}
      title="No cashiers match"
      message="Try a different name or username, or clear the search."
      action={
        <Button variant="tinted" onClick={onClear}>
          Clear search
        </Button>
      }
    />
  );
}
