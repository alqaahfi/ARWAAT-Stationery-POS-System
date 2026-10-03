import React from 'react';
import { Plus, Truck } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, EmptyState, SearchField } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { PartyNameCell, RowChevron, RowToggle, listToolbar } from '../../Parties/PartyParts';

export function SupplierToolbar({ search, onSearch, onAdd }) {
  return (
    <div style={listToolbar}>
      <SearchField
        value={search}
        onChange={onSearch}
        placeholder="Search by name or phone"
        aria-label="Search suppliers"
        style={{ flex: '1 1 220px', maxWidth: '420px' }}
      />
      <Button icon={Plus} onClick={onAdd} style={{ marginLeft: 'auto' }}>
        {glossary.addSupplier}
      </Button>
    </div>
  );
}

export function supplierColumns({ onToggleActive }) {
  return [
    {
      key: 'name',
      label: glossary.supplier,
      render: (r) => <PartyNameCell name={r.name} sub={[r.phone, r.mobile].filter(Boolean).join(' · ') || r.contact_person} inactive={!r.is_active} />,
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '160px',
      render: (r) => (r.phone ? <span style={theme.font.numeric}>{r.phone}</span> : <span style={{ color: theme.colors.labelTertiary }}>—</span>),
    },
    {
      key: 'balance',
      label: 'Balance',
      numeric: true,
      width: '200px',
      render: (r) => <BalanceChip amount={r.balance_owed} party="supplier" />,
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

export function NoSuppliers({ onAdd }) {
  return (
    <EmptyState
      icon={Truck}
      color="indigo"
      title="Add your first supplier"
      message="Suppliers are who you buy stock from. You'll pick one whenever you record a purchase."
      action={
        <Button icon={Plus} onClick={onAdd}>
          {glossary.addSupplier}
        </Button>
      }
    />
  );
}
