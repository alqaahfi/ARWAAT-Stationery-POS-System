import React, { useEffect, useState } from 'react';
import { CircleAlert, Printer } from 'lucide-react';
import theme from '../../../config/theme';
import { Badge, Button, DataTable, EmptyState, Modal, Skeleton } from '../../../components/ui';
import { formatCount, formatCurrencyExact } from '../../../utils/format';
import { formatLocalDateTime } from '../../Sales/parts/saleLabels';
import PrintPreviewModal from '../../../components/receipt/PrintPreviewModal';

const c = theme.colors;

// Read-only view of one purchase: what came in, what it cost, what was paid.
export function PurchaseDetailSheet({ purchaseId, userId, onClose, onOpenSupplier }) {
  const [state, setState] = useState({ loading: true, error: false, data: null });
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: false, data: null });
    window.api.purchases
      .getDetail({ id: purchaseId, requestingUserId: userId })
      .then((res) => {
        if (cancelled) return;
        setState(res?.success ? { loading: false, error: false, data: res } : { loading: false, error: true, data: null });
      })
      .catch(() => !cancelled && setState({ loading: false, error: true, data: null }));
    return () => {
      cancelled = true;
    };
  }, [purchaseId, userId]);

  const { loading, error, data } = state;
  const p = data?.purchase;

  const columns = [
    {
      key: 'item',
      label: 'Item',
      render: (l) => (
        <div>
          <div style={{ fontWeight: theme.font.weightSemibold }}>{l.item_name}</div>
          {l.variant_name && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{l.variant_name}</div>}
          {l.foc_quantity > 0 && <div style={{ ...theme.type.footnote, color: c.greenText }}>+ {formatCount(l.foc_quantity)} free</div>}
        </div>
      ),
    },
    { key: 'quantity', label: 'Qty', numeric: true, width: '80px', render: (l) => formatCount(l.quantity) },
    { key: 'unit_cost', label: 'Buying price', numeric: true, width: '130px', render: (l) => formatCurrencyExact(l.unit_cost) },
    { key: 'line_total', label: 'Total', numeric: true, width: '130px', render: (l) => formatCurrencyExact(l.line_total) },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      width={680}
      title={p ? p.supplier_name : 'Purchase'}
      subtitle={p ? `${formatLocalDateTime(p.purchase_date)}${p.reference_no ? ` · Bill ${p.reference_no}` : ''}` : undefined}
      footer={
        <>
          {p && (
            <Button variant="secondary" icon={Printer} onClick={() => setPreviewOpen(true)}>
              Print A4
            </Button>
          )}
          {p && (
            <Button variant="plain" onClick={() => onOpenSupplier({ id: p.supplier_id, name: p.supplier_name })}>
              Open supplier
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      {loading ? (
        <Skeleton lines={5} />
      ) : error ? (
        <EmptyState icon={CircleAlert} color="red" title="Couldn't open this purchase" message="It may have been removed." />
      ) : (
        <>
          <div style={{ border: `1px solid ${c.separator}`, borderRadius: theme.radius.md, overflow: 'hidden' }}>
            <DataTable columns={columns} rows={data.lines} dense />
          </div>
          <div style={{ marginTop: theme.spacing.md, marginLeft: 'auto', maxWidth: '300px' }}>
            <Row label="Subtotal" value={formatCurrencyExact(p.subtotal)} />
            {p.discount_amount > 0 && <Row label="Discount" value={`− ${formatCurrencyExact(p.discount_amount)}`} />}
            <Row label="Total" value={formatCurrencyExact(p.total_amount)} strong />
            <Row label="Paid when saved" value={formatCurrencyExact(p.paid_amount)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: theme.spacing.sm }}>
              {p.balance_due > 0.005 ? <Badge tone="orange">{formatCurrencyExact(p.balance_due)} left owed</Badge> : <Badge tone="green">Paid in full</Badge>}
            </div>
          </div>
        </>
      )}
      {previewOpen && <PrintPreviewModal purchaseId={purchaseId} onClose={() => setPreviewOpen(false)} />}
    </Modal>
  );
}

function Row({ label, value, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', ...theme.type.body }}>
      <span style={{ color: c.labelSecondary }}>{label}</span>
      <span style={{ ...theme.font.numeric, color: c.label, fontWeight: strong ? theme.font.weightBold : theme.font.weightMedium }}>{value}</span>
    </div>
  );
}
