import React, { memo } from 'react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { formatCurrency } from '../../../utils/format';
import { Badge } from '../../../components/ui';
import { BigSearchInput, PanelTitle, c, keepFocus } from './common';

const LIST_ID = 'pos-customer-list';
const optId = (i) => `pos-customer-opt-${i}`;

export default function CustomerPanel({ inputRef, query, onQueryChange, results, highlight, onSelect }) {
  const open = results.length > 0;
  return (
    <>
      <PanelTitle title="Who is this sale for?" hint="Type a name or phone number. Press Tab to continue as a walk-in customer." />
      <BigSearchInput
        inputRef={inputRef}
        value={query}
        onChange={onQueryChange}
        placeholder="Customer name or phone"
        label="Search customers"
        listId={LIST_ID}
        activeId={optId(highlight)}
        expanded={open}
      />
      {open ? (
        <div id={LIST_ID} role="listbox" aria-label="Customers" style={styles.list} onMouseDown={keepFocus}>
          {results.map((cust, idx) => (
            <CustomerRow key={cust.id} customer={cust} idx={idx} selected={idx === highlight} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        query.trim() && (
          <div style={styles.none}>
            No matching customer yet — press <strong>Tab</strong> to continue as a {glossary.walkIn.toLowerCase()}.
          </div>
        )
      )}
    </>
  );
}

const CustomerRow = memo(function CustomerRow({ customer, idx, selected, onSelect }) {
  const owes = Number(customer.balance_owed) || 0;
  return (
    <div
      id={optId(idx)}
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(customer)}
      style={{ ...styles.row, backgroundColor: selected ? c.accentTint : 'transparent' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...theme.type.headline, color: c.label }}>{customer.name}</div>
        {customer.phone && <div style={{ ...theme.type.footnote, color: c.labelSecondary, ...theme.font.numeric }}>{customer.phone}</div>}
      </div>
      {owes > 0 && (
        <Badge tone="orange" style={theme.font.numeric}>
          {glossary.customerOwes(formatCurrency(owes))}
        </Badge>
      )}
      <Badge tone={customer.customer_type === 'wholesale' ? 'purple' : 'blue'}>
        {customer.customer_type === 'wholesale' ? 'Wholesale' : 'Retail'}
      </Badge>
    </div>
  );
});

const styles = {
  list: { marginTop: theme.spacing.sm, overflowY: 'auto', minHeight: 0, flex: '0 1 auto', maxHeight: '392px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: '56px',
    padding: '6px 12px',
    boxSizing: 'border-box',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
  },
  none: { ...theme.type.subhead, color: c.labelSecondary, marginTop: theme.spacing.smd },
};
