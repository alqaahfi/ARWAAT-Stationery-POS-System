import React, { useEffect, useState } from 'react';
import theme from '../../../../config/theme';
import { formatCurrencyExact } from '../../../../utils/format';
import { wholeNumber } from '../../../../utils/quantity';
import { Banner, Button, Field, Modal, Select, TextInput } from '../../../../components/ui';
import BillItemSearch from '../../../../components/billing/BillItemSearch';
import { REASON_OPTIONS } from './returnUtils';
import useEntryBusy from '../../../../utils/useEntryBusy';

const c = theme.colors;

// Rule 17: a return without the bill (Admin only). Pick the item and how many;
// the refund is that item's lowest selling price in the last 30 days (or today's
// retail price if it hasn't sold), paid in cash, and the stock goes back.
export default function NoBillReturnDialog({ onClose, onDone }) {
  useEntryBusy(true, 'no-bill-return');
  const [detail, setDetail] = useState(null);
  const [unitId, setUnitId] = useState('');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(variantId) {
    const d = await window.api.sales.getVariantForCart({ variantId });
    if (!d) return;
    setDetail(d);
    setUnitId(String(d.defaultUnitId || d.units[0]?.id || ''));
  }

  useEffect(() => {
    if (!detail || !unitId) return;
    window.api.returns
      .noBillPrice({ productVariantId: detail.variant.id, productUnitId: Number(unitId) })
      .then((r) => setPrice(r?.success ? r : null))
      .catch(() => setPrice(null));
  }, [detail, unitId]);

  async function submit() {
    setError('');
    if (!detail) return setError('Choose the item that is coming back.');
    if (!(Number(qty) > 0)) return setError('Type how many are coming back.');
    if (!reason) return setError('Choose why the items are coming back.');
    setBusy(true);
    try {
      const res = await window.api.returns.createNoBill({ productVariantId: detail.variant.id, productUnitId: Number(unitId), quantity: Number(qty), reason, note });
      if (!res?.success) return setError(res?.reason || 'The return could not be recorded.');
      onDone(res);
    } finally {
      setBusy(false);
    }
  }

  const total = price ? price.price * (Number(qty) || 0) : 0;
  return (
    <Modal
      open
      onClose={onClose}
      title="Return without the bill"
      subtitle="Cash back at the item's lowest price in the last 30 days. The stock goes back on the shelf."
      width={560}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !detail}>
            Record return
          </Button>
        </>
      }
    >
      <BillItemSearch onPick={pick} />
      {detail && (
        <div style={{ marginTop: theme.spacing.md }}>
          <div style={{ ...theme.type.headline, color: c.label, marginBottom: theme.spacing.sm }}>
            {detail.product.name}
            {detail.variant.variantName && detail.variant.variantName !== 'Standard' ? ` · ${detail.variant.variantName}` : ''}
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <Field label="Pack size">
              <Select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                {detail.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="How many">
              <TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(wholeNumber(e.target.value))} style={{ width: '100px' }} />
            </Field>
            <Field label="Why">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="">Choose…</option>
                {REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Note (optional)">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {price && (
            <div style={{ ...theme.type.body, color: c.label }}>
              Cash back: <strong>{formatCurrencyExact(total)}</strong>{' '}
              <span style={{ color: c.labelSecondary }}>
                ({formatCurrencyExact(price.price)} each — {price.source === 'retail' ? "today's retail price (not sold in 30 days)" : 'lowest price in the last 30 days'})
              </span>
            </div>
          )}
        </div>
      )}
      <Banner>{error}</Banner>
    </Modal>
  );
}
