import React, { useEffect, useRef, useState } from 'react';
import theme from '../../config/theme';
import { formatCurrency } from '../../utils/format';
import { Banner, Button, Field, Modal, NumberInput, TextInput } from '../ui';
import useEntryBusy from '../../utils/useEntryBusy';

const c = theme.colors;

// Rule 11: "Add missing items at the counter". Barcode (optional, must be new),
// Name (required — similar names already in the shop are shown so the cashier
// can pick the real item instead), Retail price (> 0). The new item is flagged
// for the Admin to review and can be sold even with no stock.
export default function QuickAddItemDialog({ initial, onClose, onAdded, onPickExisting }) {
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [name, setName] = useState(initial?.name || '');
  const [price, setPrice] = useState('');
  const [similar, setSimilar] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEntryBusy(true, 'quick-add-item'); // open while the dialog is
  const nameRef = useRef(null);
  const priceRef = useRef(null);

  useEffect(() => {
    (initial?.name ? priceRef : nameRef).current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Similar names already in the shop (debounced).
  useEffect(() => {
    const text = name.trim();
    if (text.length < 2) {
      setSimilar([]);
      return undefined;
    }
    const t = setTimeout(() => {
      window.api.products
        .findSimilar({ name: text })
        .then((res) => setSimilar(res?.matches || []))
        .catch(() => setSimilar([]));
    }, 250);
    return () => clearTimeout(t);
  }, [name]);

  async function submit(e) {
    e?.preventDefault?.();
    if (busy) return;
    setError('');
    if (!name.trim()) {
      setError('Type the item name.');
      nameRef.current?.focus();
      return;
    }
    if (!(Number(price) > 0)) {
      setError('Type a selling price above zero.');
      priceRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await window.api.products.quickAdd({ barcode: barcode.trim() || null, name: name.trim(), retailPrice: Number(price) });
      if (!res?.success) {
        setError(res?.reason || 'Could not add the item.');
        return;
      }
      onAdded(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add a missing item"
      subtitle="It is added to the shop list and to this bill. The Admin checks it later."
      width={520}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Add to bill
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Field label="Barcode (optional)">
          <TextInput value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type, or leave empty" autoComplete="off" />
        </Field>
        <Field label="Name">
          <TextInput ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue gel pen" autoComplete="off" maxLength={200} />
        </Field>
        {similar.length > 0 && (
          <div style={{ marginTop: `-${theme.spacing.xs}`, marginBottom: theme.spacing.md }}>
            <div style={{ ...theme.type.footnote, color: c.orangeText, marginBottom: '4px' }}>
              Similar items are already in the shop. Is it one of these?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {similar.map((m) => (
                <Button key={m.productId} type="button" variant="secondary" size="sm" onClick={() => onPickExisting(m.variantId)} style={{ justifyContent: 'space-between' }}>
                  <span>{m.name}</span>
                  <span style={theme.font.numeric}>{formatCurrency(m.retailPrice)}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
        <Field label="Selling price (retail)">
          <NumberInput
            ref={priceRef}
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
          />
        </Field>
        <Banner>{error}</Banner>
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
