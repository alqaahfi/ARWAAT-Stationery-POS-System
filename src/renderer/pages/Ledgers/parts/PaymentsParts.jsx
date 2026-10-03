import React from 'react';
import { Printer, SearchX, Wallet } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Button, ChipGroup, EmptyState, IconButton, Menu, MenuItem, Popover, SearchField, Select, TextInput } from '../../../components/ui';
import { formatCurrency, formatDateOnly } from '../../../utils/format';
import { DateCell, PartyCell, RowControl } from './LedgerParts';
import { METHOD_OPTIONS, formatTime, methodLabel } from './ledgerUtils';

const c = theme.colors;

const PARTY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'customer', label: 'Customers' },
  { value: 'supplier', label: 'Suppliers' },
];

export function PaymentsToolbar({ search, onSearch, partyType, onPartyType, method, onMethod, dateFrom, onDateFrom, dateTo, onDateTo }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm }}>
      <SearchField value={search} onChange={onSearch} placeholder="Search by name" aria-label="Search by name" style={{ flex: '1 1 200px', maxWidth: '280px' }} />
      <ChipGroup options={PARTY_OPTIONS} value={partyType} onChange={onPartyType} aria-label="Who" />
      <Select value={method} onChange={(e) => onMethod(e.target.value)} aria-label="Payment method" style={{ width: '150px' }}>
        <option value="">All methods</option>
        {METHOD_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </Select>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <TextInput type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} aria-label="From date" style={{ width: '150px' }} />
        <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>to</span>
        <TextInput type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} aria-label="To date" style={{ width: '150px' }} />
      </div>
    </div>
  );
}

// up: open above the button (lower rows), so the table's scroll box never
// clips the menu.
function ReprintMenu({ row, open, up, onToggle, onPrint }) {
  return (
    <RowControl>
      <Popover
        open={open}
        onClose={() => onToggle(null)}
        width={180}
        style={up ? { top: 'auto', bottom: 'calc(100% + 6px)' } : undefined}
        anchor={<IconButton icon={Printer} label="Print receipt" size="sm" aria-haspopup="menu" aria-expanded={open} onClick={() => onToggle(open ? null : row.id)} />}
      >
        {(close) => (
          <Menu label="Receipt size">
            <MenuItem
              label={glossary.smallReceipt}
              onClick={() => {
                close();
                onPrint(row.id, 'thermal');
              }}
            />
            <MenuItem
              label={glossary.a4Receipt}
              onClick={() => {
                close();
                onPrint(row.id, 'a4');
              }}
            />
          </Menu>
        )}
      </Popover>
    </RowControl>
  );
}

// rowIndex: id -> position, to decide which way the reprint menu opens.
export function paymentColumns({ hasRecordedBy, menuId, onMenu, onPrint, rowIndex }) {
  const cols = [
    { key: 'date', label: 'Date', width: '120px', render: (r) => <DateCell date={formatDateOnly(r.created_at)} time={formatTime(r.created_at)} /> },
    { key: 'party', label: 'Party', render: (r) => <PartyCell name={r.party_name} /> },
    {
      key: 'type',
      label: 'Type',
      render: (r) =>
        r.party_type === 'supplier' ? <Badge tone="orange">{glossary.supplierPayment}</Badge> : <Badge tone="green">{glossary.customerPayment}</Badge>,
    },
    { key: 'method', label: 'Method', render: (r) => methodLabel(r.payment_method) },
    { key: 'amount', label: 'Amount', numeric: true, render: (r) => <span style={{ fontWeight: theme.font.weightSemibold }}>{formatCurrency(r.amount)}</span> },
    {
      key: 'linked',
      label: 'Linked to',
      render: (r) => (r.sale_invoice_no ? r.sale_invoice_no : <span style={{ color: c.labelSecondary }}>Standalone</span>),
    },
  ];
  if (hasRecordedBy) cols.push({ key: 'by', label: 'Recorded by', render: (r) => r.recorded_by_name || '—' });
  cols.push({
    key: 'print',
    label: <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Receipt</span>,
    width: '56px',
    align: 'right',
    render: (r) => <ReprintMenu row={r} open={menuId === r.id} up={(rowIndex.get(r.id) ?? 0) >= 2} onToggle={onMenu} onPrint={onPrint} />,
  });
  return cols;
}

export function PaymentsEmpty({ filtered, onClear }) {
  if (filtered) {
    return (
      <EmptyState
        icon={SearchX}
        title="Nothing matches"
        message="Try another name, method or date."
        action={
          <Button variant="tinted" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    );
  }
  return <EmptyState icon={Wallet} title="No payments yet" message="Payments from customers and to suppliers will show up here." />;
}
