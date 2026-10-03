import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import theme from '../../../config/theme';
import { Badge, Card, DataTable, Icon } from '../../../components/ui';
import { formatCount, formatCurrencyExact } from '../../../utils/format';
import { formatLocalDateTime } from '../../Sales/parts/saleLabels';

const c = theme.colors;

export function PurchaseTable({ rows, loading, onOpen }) {
  const columns = useMemo(
    () => [
      {
        key: 'supplier',
        label: 'Supplier',
        render: (r) => (
          <div>
            <div style={styles.strong}>{r.supplier_name}</div>
            <div style={styles.foot}>
              {formatLocalDateTime(r.purchase_date)}
              {r.reference_no ? ` · Bill ${r.reference_no}` : ''}
            </div>
          </div>
        ),
      },
      { key: 'items', label: 'Items', numeric: true, width: '90px', render: (r) => formatCount(r.item_count) },
      { key: 'total', label: 'Total', numeric: true, width: '140px', render: (r) => <span style={styles.strong}>{formatCurrencyExact(r.total_amount)}</span> },
      { key: 'paid', label: 'Paid', numeric: true, width: '140px', render: (r) => formatCurrencyExact(r.paid_amount) },
      {
        key: 'status',
        label: 'Payment',
        width: '150px',
        render: (r) =>
          r.balance_due > 0.005 ? (
            <div>
              <Badge tone="orange">{r.paid_amount > 0 ? 'Partly paid' : 'Not paid'}</Badge>
              <div style={{ ...styles.foot, ...theme.font.numeric }}>{formatCurrencyExact(r.balance_due)} owed</div>
            </div>
          ) : (
            <Badge tone="green">Paid</Badge>
          ),
      },
      { key: 'chevron', label: '', width: '36px', render: () => <Icon icon={ChevronRight} size={16} style={{ color: c.labelTertiary, display: 'block' }} /> },
    ],
    []
  );

  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={onOpen} />
    </Card>
  );
}

const styles = {
  strong: { fontWeight: theme.font.weightSemibold, color: c.label },
  foot: { ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' },
};
