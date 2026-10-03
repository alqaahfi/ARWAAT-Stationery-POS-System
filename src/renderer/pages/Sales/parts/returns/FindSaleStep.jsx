import React, { memo, useId } from 'react';
import { CircleAlert, SearchX } from 'lucide-react';
import theme from '../../../../config/theme';
import appIcons from '../../../../config/appIcons';
import glossary from '../../../../config/glossary';
import { Badge, Button, Card, EmptyState, Icon, SearchField, Skeleton, Spinner } from '../../../../components/ui';
import { formatCurrencyExact } from '../../../../utils/format';
import { RETURN_STATUS, formatLocalDateTime } from '../saleLabels';

const c = theme.colors;

// Step 1: search sales and pick the one being returned. The input keeps focus;
// Up/Down move the highlighted result, Enter picks it, Esc clears.
export function FindSaleStep({ query, onQuery, results, loading, error, onRetry, highlight, onHighlight, onPick, picking, message }) {
  const listId = useId();
  const hasQuery = query.trim().length > 0;
  const optionId = (i) => `${listId}-opt-${i}`;

  function onKeyDown(e) {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onHighlight(Math.min(results.length - 1, highlight + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onHighlight(Math.max(0, highlight - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlight]) onPick(results[highlight]);
    }
  }

  let list;
  if (!hasQuery) {
    list = <EmptyState {...appIcons.search} title="Find the sale" message="Search for the sale the customer is returning." style={{ padding: '40px 24px' }} />;
  } else if (error) {
    list = (
      <div role="alert" style={styles.error}>
        <Icon icon={CircleAlert} size={18} />
        <span style={{ flex: 1 }}>Couldn't search sales.</span>
        <Button size="sm" variant="tinted" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  } else if (loading && !results.length) {
    list = (
      <div style={{ padding: theme.spacing.md, display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height="18px" />
        ))}
      </div>
    );
  } else if (!results.length) {
    list = <EmptyState icon={SearchX} title="No sales match" message="Check the invoice number, or search by customer name or phone." style={{ padding: '40px 24px' }} />;
  } else {
    list = (
      <ul id={listId} role="listbox" aria-label="Sales" style={styles.list}>
        {results.map((s, i) => (
          <SaleOption key={s.id} id={optionId(i)} sale={s} active={i === highlight} first={i === 0} onPick={onPick} onHover={() => onHighlight(i)} />
        ))}
      </ul>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <SearchField
        value={query}
        onChange={onQuery}
        onKeyDown={onKeyDown}
        autoFocus
        placeholder="Invoice number, customer name or phone"
        aria-label="Find the sale"
        aria-controls={results.length ? listId : undefined}
        aria-activedescendant={results.length ? optionId(highlight) : undefined}
        aria-autocomplete="list"
        inputStyle={{ height: '44px', ...theme.type.headline, fontWeight: theme.font.weightNormal }}
        style={{ maxWidth: '640px' }}
      />
      {message && (
        <div role="alert" style={styles.error}>
          <Icon icon={CircleAlert} size={18} />
          <span>{message}</span>
        </div>
      )}
      {picking && (
        <div style={{ ...styles.foot, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <Spinner size={16} /> Opening sale…
        </div>
      )}
      <Card padding="0" style={{ overflow: 'hidden', maxWidth: '760px' }}>
        {list}
      </Card>
    </div>
  );
}

const SaleOption = memo(function SaleOption({ id, sale, active, first, onPick, onHover }) {
  const badge = RETURN_STATUS[sale.return_status];
  return (
    <li
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(sale)}
      onMouseEnter={onHover}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: '52px',
        padding: `8px ${theme.spacing.md}`,
        boxSizing: 'border-box',
        cursor: 'pointer',
        borderTop: first ? 'none' : `1px solid ${c.separator}`,
        backgroundColor: active ? c.blueTint : 'transparent',
        boxShadow: active ? `inset 3px 0 0 ${c.accent}` : 'none',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <span style={{ fontWeight: theme.font.weightSemibold, color: c.label }}>{sale.invoice_no}</span>
          {badge && (
            <Badge tone="neutral" size="sm">
              {badge}
            </Badge>
          )}
        </div>
        <div style={styles.foot}>
          {formatLocalDateTime(sale.created_at)} · {sale.customer_name || glossary.walkIn}
        </div>
      </div>
      <span style={{ ...theme.font.numeric, fontWeight: theme.font.weightSemibold, color: c.label }}>{formatCurrencyExact(sale.total_amount)}</span>
    </li>
  );
});

const styles = {
  list: { listStyle: 'none', margin: 0, padding: 0, maxHeight: '420px', overflowY: 'auto' },
  foot: { ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' },
  error: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, color: c.redText, ...theme.type.subhead, padding: `${theme.spacing.smd} ${theme.spacing.md}` },
};
