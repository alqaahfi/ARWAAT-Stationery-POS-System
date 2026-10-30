import React, { useCallback, useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import theme from '../../config/theme';
import { formatCount } from '../../utils/format';
import { Badge, Banner, Button, Card, DataTable, EmptyState, useToast } from '../../components/ui';
import { formatLocalDateTime } from '../Sales/parts/saleLabels';
import { STOCK_CHANGED_EVENT } from '../../utils/appEvents';

const c = theme.colors;

const typeText = (r) => (r.variant_name && r.variant_name !== 'Standard' ? ` · ${r.variant_name}` : '');

// Rule 12: items sold with not enough stock (Admin approved) and every Type
// whose stock is below zero. Count the shelf, fix it with Add / Delete Stock,
// then mark the entry counted.
export default function StockRecount({ onNavigate }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    window.api.stock
      .listRecount()
      .then((res) => {
        if (!res?.success) throw new Error(res?.reason);
        setData(res);
        setError('');
      })
      .catch(() => setError("The list couldn't be loaded."));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(STOCK_CHANGED_EVENT, load);
    return () => window.removeEventListener(STOCK_CHANGED_EVENT, load);
  }, [load]);

  async function markCounted(row) {
    const res = await window.api.stock.resolveRecount({ id: row.id });
    if (!res?.success) {
      toast.error(res?.reason || 'Could not update the list.');
      return;
    }
    toast.success('Marked as counted');
    load();
  }

  const entryColumns = [
    {
      key: 'product_name',
      label: 'Item',
      render: (r) => (
        <div>
          <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold }}>
            {r.product_name}
            {typeText(r)}
          </div>
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{r.note || 'Sold with not enough stock'}</div>
        </div>
      ),
    },
    { key: 'created_at', label: 'When', width: '170px', render: (r) => formatLocalDateTime(r.created_at) },
    { key: 'created_by_name', label: 'Cashier', width: '140px', render: (r) => r.created_by_name || '—' },
    {
      key: 'stock_qty',
      label: 'In stock now',
      numeric: true,
      width: '110px',
      render: (r) => <span style={{ color: Number(r.stock_qty) < 0 ? c.redText : c.label }}>{formatCount(r.stock_qty)}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: '240px',
      render: (r) => (
        <div style={{ display: 'flex', gap: theme.spacing.xs, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="secondary" onClick={() => onNavigate('/products/profile', { id: r.product_id })}>
            Open item
          </Button>
          <Button size="sm" icon={CircleCheck} onClick={() => markCounted(r)}>
            Counted
          </Button>
        </div>
      ),
    },
  ];

  const belowColumns = [
    { key: 'product_name', label: 'Item', render: (r) => `${r.product_name}${typeText(r)}` },
    {
      key: 'stock_qty',
      label: 'In stock',
      numeric: true,
      width: '110px',
      render: (r) => <span style={{ color: c.redText, fontWeight: theme.font.weightSemibold }}>{formatCount(r.stock_qty)}</span>,
    },
    { key: 'note', label: '', width: '180px', render: (r) => (r.needs_review ? <Badge tone="orange">Added at the counter</Badge> : null) },
    {
      key: 'actions',
      label: '',
      width: '140px',
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => onNavigate('/products/profile', { id: r.product_id })}>
          Open item
        </Button>
      ),
    },
  ];

  return (
    <div style={{ paddingBottom: '48px' }}>
      <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginBottom: theme.spacing.md }}>
        Items sold when the shelf count said there were not enough. Count them, fix the stock with Add Stock / Delete Stock, then
        mark them counted.
      </div>
      <Banner tone="error">{error}</Banner>
      <Card padding="0" style={{ marginBottom: theme.spacing.lg }}>
        <DataTable
          columns={entryColumns}
          rows={data?.entries || []}
          loading={!data && !error}
          emptyState={<EmptyState icon={CircleCheck} title="Nothing to recount" message="Items sold without enough stock show up here." />}
        />
      </Card>
      {data?.belowZero?.length > 0 && (
        <>
          <div style={{ ...theme.type.headline, color: c.label, marginBottom: theme.spacing.sm }}>Stock below zero</div>
          <Card padding="0">
            <DataTable columns={belowColumns} rows={data.belowZero} rowKey="product_variant_id" />
          </Card>
        </>
      )}
    </div>
  );
}
