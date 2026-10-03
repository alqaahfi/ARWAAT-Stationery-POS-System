import React from 'react';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, ChipGroup, IconButton, SearchField, Select } from '../../../components/ui';
import DateRangePicker from '../../Reports/components/DateRangePicker';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: glossary.paid },
  { value: 'partial', label: glossary.partlyPaid },
  { value: 'unpaid', label: glossary.notPaid },
];

export const SALE_SORT_OPTIONS = [
  { key: 'date', label: 'Date' },
  { key: 'total', label: 'Total' },
  { key: 'due', label: 'Unpaid amount' },
  { key: 'customer', label: 'Customer (A–Z)' },
  { key: 'invoice', label: 'Invoice number' },
];

export function SalesToolbar({ search, onSearch, range, onRange, status, onStatus, saleType, onSaleType, cashierId, onCashier, cashiers, isAdmin, sortBy, onSortBy, sortDir, onSortDir, onNewSale }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.row}>
        <SearchField
          value={search}
          onChange={onSearch}
          placeholder="Search invoice number, customer or phone"
          aria-label="Search sales"
          style={{ flex: '1 1 280px', minWidth: '240px', maxWidth: '420px' }}
        />
        <ChipGroup options={STATUS_OPTIONS} value={status} onChange={onStatus} size="sm" aria-label="Payment" />
        <Select value={saleType} onChange={(e) => onSaleType(e.target.value)} aria-label="Sale type" style={{ width: '140px' }}>
          <option value="all">All types</option>
          <option value="retail">{glossary.retail}</option>
          <option value="wholesale">{glossary.wholesale}</option>
        </Select>
        {isAdmin && (
          <Select value={cashierId} onChange={(e) => onCashier(e.target.value)} aria-label="Cashier" style={{ width: '180px' }}>
            <option value="">All cashiers</option>
            {cashiers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div style={styles.row}>
        <DateRangePicker value={range} onChange={onRange} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <Select aria-label="Sort by" value={sortBy} onChange={(e) => onSortBy(e.target.value)} style={{ width: '190px' }}>
            {SALE_SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                Sort: {o.label}
              </option>
            ))}
          </Select>
          <IconButton
            icon={sortDir === 'asc' ? ArrowUp : ArrowDown}
            label={sortDir === 'asc' ? 'Sorted low to high — click to reverse' : 'Sorted high to low — click to reverse'}
            onClick={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          />
        </div>
        {onNewSale && (
          <Button icon={Plus} onClick={onNewSale} style={{ marginLeft: 'auto' }}>
            {glossary.newSale}
          </Button>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: theme.spacing.smd, marginBottom: theme.spacing.md },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm },
};
