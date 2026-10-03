import React from 'react';
import { Plus, Users } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Button, ChipGroup, EmptyState, SearchField, Select } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { PRICE_LEVELS, priceLevelLabel } from '../../../utils/priceLevel';
import { PartyNameCell, RowChevron, RowToggle, listToolbar } from '../../Parties/PartyParts';
import { PartyViewToggle } from '../../Parties/PartyViews';

const TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
];

export function CustomerToolbar({ search, onSearch, typeFilter, onTypeFilter, tierFilter, onTierFilter, viewMode, onViewMode, onAdd }) {
  return (
    <div style={listToolbar}>
      <SearchField
        value={search}
        onChange={onSearch}
        placeholder="Search by name or phone"
        aria-label="Search customers"
        style={{ flex: '1 1 220px', maxWidth: '420px' }}
      />
      <ChipGroup aria-label="Customer type" options={TYPE_OPTIONS} value={typeFilter} onChange={onTypeFilter} />
      <Select aria-label="Price Level" value={tierFilter} onChange={(e) => onTierFilter(e.target.value)} style={{ width: '160px' }}>
        <option value="">Any level</option>
        <option value="NONE">{glossary.noPriceLevel}</option>
        {PRICE_LEVELS.map((t) => (
          <option key={t} value={t}>
            {priceLevelLabel(t)}
          </option>
        ))}
      </Select>
      <PartyViewToggle value={viewMode} onChange={onViewMode} />
      <Button icon={Plus} onClick={onAdd} style={{ marginLeft: 'auto' }}>
        {glossary.addCustomer}
      </Button>
    </div>
  );
}

export function TypeBadge({ type }) {
  return type === 'wholesale' ? <Badge tone="purple">Wholesale</Badge> : <Badge tone="blue">Retail</Badge>;
}

export function customerColumns({ onToggleActive, compact = false }) {
  if (compact) {
    return [
      { key: 'name', label: glossary.customer, render: (r) => <span style={{ fontWeight: theme.font.weightSemibold, opacity: r.is_active ? 1 : 0.6 }}>{r.name}</span> },
      { key: 'type', label: 'Type', width: '110px', render: (r) => <TypeBadge type={r.customer_type} /> },
      { key: 'balance', label: 'Balance', numeric: true, width: '200px', render: (r) => <BalanceChip amount={r.balance_owed} party="customer" /> },
      { key: 'go', label: '', width: '32px', align: 'right', render: () => <RowChevron /> },
    ];
  }
  return [
    {
      key: 'name',
      label: glossary.customer,
      render: (r) => <PartyNameCell name={r.name} sub={[r.phone, r.mobile].filter(Boolean).join(' · ') || undefined} inactive={!r.is_active} />,
    },
    { key: 'type', label: 'Type', width: '120px', render: (r) => <TypeBadge type={r.customer_type} /> },
    {
      key: 'tier',
      label: 'Price Level',
      width: '140px',
      render: (r) => (r.tier ? <Badge>{priceLevelLabel(r.tier)}</Badge> : <span style={{ color: theme.colors.labelTertiary }}>—</span>),
    },
    {
      key: 'balance',
      label: 'Balance',
      numeric: true,
      width: '200px',
      render: (r) => <BalanceChip amount={r.balance_owed} party="customer" />,
    },
    {
      key: 'active',
      label: 'Active',
      width: '80px',
      render: (r) => <RowToggle checked={!!r.is_active} onChange={() => onToggleActive(r)} label={`${r.name} is active`} />,
    },
    { key: 'go', label: '', width: '32px', align: 'right', render: () => <RowChevron /> },
  ];
}

// Cards view helpers.
export const customerBadges = (r) => (
  <>
    <TypeBadge type={r.customer_type} />
    {r.tier && <Badge>{priceLevelLabel(r.tier)}</Badge>}
  </>
);
export const customerSubline = (r) => [r.phone, r.mobile].filter(Boolean).join(' · ') || undefined;

export function NoCustomers({ onAdd }) {
  return (
    <EmptyState
      icon={Users}
      color="blue"
      title="Add your first customer"
      message="Customers you add here can be picked when making a sale, and can pay later."
      action={
        <Button icon={Plus} onClick={onAdd}>
          {glossary.addCustomer}
        </Button>
      }
    />
  );
}
