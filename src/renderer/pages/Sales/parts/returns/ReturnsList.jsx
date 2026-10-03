import React, { useMemo } from 'react';
import { ChevronRight, CircleAlert, Plus, SearchX } from 'lucide-react';
import theme from '../../../../config/theme';
import appIcons from '../../../../config/appIcons';
import glossary from '../../../../config/glossary';
import { Badge, Button, Card, DataTable, EmptyState, Icon, SearchField } from '../../../../components/ui';
import { formatCount, formatCurrencyExact } from '../../../../utils/format';
import DateRangePicker from '../../../Reports/components/DateRangePicker';
import { formatLocalDateTime } from '../saleLabels';
import { reasonLabel } from './returnUtils';

const c = theme.colors;

export function ReturnsToolbar({ search, onSearch, range, onRange, onNew }) {
  return (
    <div style={styles.toolbar}>
      <div style={styles.row}>
        <SearchField
          value={search}
          onChange={onSearch}
          placeholder="Search return number, invoice or customer"
          aria-label="Search returns"
          style={{ flex: '1 1 280px', minWidth: '240px', maxWidth: '420px' }}
        />
        <Button icon={Plus} onClick={onNew} style={{ marginLeft: 'auto' }}>
          {glossary.newReturn}
        </Button>
      </div>
      <DateRangePicker value={range} onChange={onRange} />
    </div>
  );
}

// Cash back / credited split as one or two badges.
export function RefundBadges({ total, cash }) {
  const credited = Math.max(0, Number(total) - Number(cash));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {cash > 0 && <Badge tone="blue">Cash back {formatCurrencyExact(cash)}</Badge>}
      {credited > 0.004 && <Badge tone="neutral">Credited {formatCurrencyExact(credited)}</Badge>}
    </div>
  );
}

export function ReturnsTable({ rows, loading, onOpen, onOpenSale }) {
  const columns = useMemo(
    () => [
      {
        key: 'return',
        label: 'Return',
        render: (r) => (
          <div>
            <div style={styles.strong}>{r.return_no}</div>
            <div style={styles.foot}>{formatLocalDateTime(r.created_at)}</div>
          </div>
        ),
      },
      {
        key: 'customer',
        label: glossary.customer,
        render: (r) => (r.customer_name ? r.customer_name : <span style={{ color: c.labelSecondary }}>{glossary.walkIn}</span>),
      },
      {
        key: 'sale',
        label: 'Original sale',
        render: (r) => (
          <Button
            variant="plain"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSale(r.sale_id);
            }}
            style={{ padding: '0 4px', marginLeft: '-4px' }}
          >
            {r.invoice_no}
          </Button>
        ),
      },
      { key: 'reason', label: 'Reason', render: (r) => reasonLabel(r.reason) },
      { key: 'items', label: 'Items', numeric: true, width: '70px', render: (r) => formatCount(r.item_count) },
      {
        key: 'value',
        label: 'Value',
        numeric: true,
        width: '120px',
        render: (r) => <span style={styles.strong}>{formatCurrencyExact(r.total_amount)}</span>,
      },
      { key: 'refund', label: 'Refund', width: '190px', render: (r) => <RefundBadges total={r.total_amount} cash={r.cash_refund_amount} /> },
      {
        key: 'chevron',
        label: <span style={styles.srOnly}>Open</span>,
        width: '36px',
        render: () => <Icon icon={ChevronRight} size={16} style={{ color: c.labelTertiary, display: 'block' }} />,
      },
    ],
    [onOpenSale]
  );

  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={onOpen} />
    </Card>
  );
}

export function ReturnsSummary({ total }) {
  return (
    <p style={styles.summary}>
      {formatCount(total)} {total === 1 ? 'return' : 'returns'}
    </p>
  );
}

export function ReturnsEmpty({ anyReturns, onNew, onClear }) {
  return (
    <Card padding="0">
      {anyReturns ? (
        <EmptyState
          icon={SearchX}
          title="No returns match"
          message="Try a different date range or search."
          action={
            <Button variant="tinted" onClick={onClear}>
              Clear filters
            </Button>
          }
          style={{ padding: '56px 24px' }}
        />
      ) : (
        <EmptyState
          {...appIcons.returns}
          title="No returns yet"
          message="When a customer brings something back, record it here."
          action={<Button onClick={onNew}>{glossary.newReturn}</Button>}
          style={{ padding: '56px 24px' }}
        />
      )}
    </Card>
  );
}

export function LoadErrorCard({ message, onRetry }) {
  return (
    <Card>
      <div role="alert" style={styles.error}>
        <Icon icon={CircleAlert} size={18} />
        <span style={{ flex: 1 }}>{message}</span>
        <Button size="sm" variant="tinted" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </Card>
  );
}

const styles = {
  toolbar: { display: 'flex', flexDirection: 'column', gap: theme.spacing.smd, marginBottom: theme.spacing.md },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm },
  strong: { fontWeight: theme.font.weightSemibold, color: c.label },
  foot: { ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' },
  summary: { ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, margin: `0 0 ${theme.spacing.sm}` },
  srOnly: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' },
  error: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, color: c.redText, ...theme.type.subhead },
};
