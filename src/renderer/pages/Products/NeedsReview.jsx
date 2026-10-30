import React, { useCallback, useEffect, useState } from 'react';
import { CircleCheck, Merge, Pencil } from 'lucide-react';
import theme from '../../config/theme';
import { formatCount, formatCurrency } from '../../utils/format';
import { formatLocalDateTime } from '../Sales/parts/saleLabels';
import { Badge, Banner, Button, Card, DataTable, EmptyState, Modal, Select, useConfirm, useToast } from '../../components/ui';
import BillItemSearch from '../../components/billing/BillItemSearch';
import { STOCK_CHANGED_EVENT } from '../../utils/appEvents';

const c = theme.colors;

// Rule 11: items a cashier added at the counter ("Add missing items at the
// counter"). The Admin sets the buying price (Edit), other prices, category and
// stock, then Approves — or Merges the item into a product that already exists.
export default function NeedsReview({ onNavigate }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [merging, setMerging] = useState(null);

  const load = useCallback(() => {
    window.api.products
      .listNeedsReview()
      .then((res) => {
        if (!res?.success) throw new Error(res?.reason);
        setRows(res.rows);
        setError('');
      })
      .catch(() => setError("The list couldn't be loaded."));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(STOCK_CHANGED_EVENT, load);
    return () => window.removeEventListener(STOCK_CHANGED_EVENT, load);
  }, [load]);

  async function approve(row) {
    const res = await window.api.products.approveReview({ productId: row.id });
    if (!res?.success) {
      toast.error(res?.reason || 'Could not approve the item.');
      return;
    }
    toast.success(`${row.name} approved`);
    window.dispatchEvent(new Event(STOCK_CHANGED_EVENT));
    load();
  }

  async function doMerge({ variantId, unitId, targetName }) {
    const row = merging;
    const ok = await confirm({
      title: 'Merge this item?',
      message: `"${row.name}" will be joined into "${targetName}": its sales and stock move across and "${row.name}" is switched off. This can't be undone.`,
      confirmLabel: 'Merge',
      cancelLabel: 'Go back',
    });
    if (!ok) return;
    const res = await window.api.products.mergeReview({ productId: row.id, intoVariantId: variantId, intoUnitId: unitId });
    if (!res?.success) {
      toast.error(res?.reason || 'Could not merge the item.');
      return;
    }
    toast.success(`${row.name} merged into ${targetName}`);
    setMerging(null);
    window.dispatchEvent(new Event(STOCK_CHANGED_EVENT));
    load();
  }

  const columns = [
    {
      key: 'name',
      label: 'Item',
      render: (r) => (
        <div>
          <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold }}>{r.name}</div>
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>
            Added {formatLocalDateTime(r.created_at)}
            {r.barcode ? ` · Barcode ${r.barcode}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'retail_price', label: 'Selling price', numeric: true, width: '120px', render: (r) => formatCurrency(r.retail_price) },
    {
      key: 'min_cost',
      label: 'Buying price',
      width: '150px',
      render: (r) => (r.buyingPriceMissing ? <Badge tone="orange">Missing</Badge> : formatCurrency(r.min_cost)),
    },
    { key: 'sold_qty', label: 'Sold', numeric: true, width: '80px', render: (r) => formatCount(r.sold_qty) },
    {
      key: 'stock',
      label: 'In stock',
      numeric: true,
      width: '90px',
      render: (r) => <span style={{ color: Number(r.stock) < 0 ? c.redText : c.label }}>{formatCount(r.stock)}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: '300px',
      render: (r) => (
        <div style={{ display: 'flex', gap: theme.spacing.xs, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => onNavigate('/products/edit', { id: r.id })}>
            Edit
          </Button>
          <Button size="sm" variant="secondary" icon={Merge} onClick={() => setMerging(r)}>
            Merge
          </Button>
          <Button size="sm" icon={CircleCheck} onClick={() => approve(r)} disabled={r.buyingPriceMissing} title={r.buyingPriceMissing ? 'Set the buying price first (Edit)' : undefined}>
            Approve
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ paddingBottom: '48px' }}>
      <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginBottom: theme.spacing.md }}>
        Items added at the counter while selling. Edit each one to set its buying price, other prices, category and stock, then
        Approve it — or Merge it into the product it really is.
      </div>
      <Banner tone="error">{error}</Banner>
      <Card padding="0">
        <DataTable
          columns={columns}
          rows={rows || []}
          loading={rows === null && !error}
          emptyState={<EmptyState icon={CircleCheck} title="Nothing to review" message="Items added at the counter show up here." />}
        />
      </Card>
      {merging && <MergeDialog item={merging} onClose={() => setMerging(null)} onMerge={doMerge} />}
    </div>
  );
}

function MergeDialog({ item, onClose, onMerge }) {
  const [target, setTarget] = useState(null); // { detail }
  const [unitId, setUnitId] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(variantId) {
    const detail = await window.api.sales.getVariantForCart({ variantId });
    if (!detail || detail.product.id === item.id) return;
    setTarget(detail);
    const piece = detail.units.find((u) => Number(u.conversionFactor) === 1) || detail.units[0];
    setUnitId(piece ? String(piece.id) : '');
  }

  async function submit() {
    if (!target || !unitId) return;
    setBusy(true);
    try {
      await onMerge({ variantId: target.variant.id, unitId: Number(unitId), targetName: target.product.name });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Merge "${item.name}"`}
      subtitle="Find the product this item really is."
      width={560}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!target || !unitId || busy}>
            Merge
          </Button>
        </>
      }
    >
      <BillItemSearch onPick={pick} />
      {target && (
        <div style={{ marginTop: theme.spacing.md }}>
          <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold }}>
            {target.product.name}
            {target.variant.variantName && target.variant.variantName !== 'Standard' ? ` · ${target.variant.variantName}` : ''}
          </div>
          <label style={{ ...theme.type.subhead, color: c.labelSecondary, display: 'block', marginTop: theme.spacing.sm }}>
            Pack size the sold pieces count as
            <Select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={{ marginTop: '4px' }}>
              {target.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitName} ({formatCount(u.conversionFactor)} per pack)
                </option>
              ))}
            </Select>
          </label>
        </div>
      )}
    </Modal>
  );
}
