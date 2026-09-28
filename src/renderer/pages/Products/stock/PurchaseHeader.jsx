import React, { useRef } from 'react';
import theme from '../../../config/theme';
import { Card, Field, Select, TextInput } from '../../../components/ui';

// "Supplier & bill" card. Picking a supplier with the mouse (or Enter) moves
// focus on to the item search; arrowing through the closed list does not.
export function PurchaseHeader({ suppliers, supplierId, onSupplierChange, referenceNo, onReferenceChange, error, onSupplierChosen }) {
  const keyNav = useRef(false);

  return (
    <Card title="Supplier & bill" style={{ marginBottom: theme.spacing.md }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
        <Field label="Supplier" required error={error} style={{ marginBottom: 0 }}>
          <Select
            id="purchase-supplier"
            autoFocus
            value={supplierId}
            onKeyDown={(e) => {
              keyNav.current = e.key !== 'Enter' && e.key !== 'Tab';
              if (e.key === 'Enter' && supplierId) {
                e.preventDefault();
                onSupplierChosen();
              }
            }}
            onChange={(e) => {
              onSupplierChange(e.target.value);
              if (e.target.value && !keyNav.current) onSupplierChosen();
              keyNav.current = false;
            }}
          >
            <option value="">Choose a supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bill / reference number" hint="Optional — the number on the supplier's bill" style={{ marginBottom: 0 }}>
          <TextInput id="purchase-reference" value={referenceNo} onChange={(e) => onReferenceChange(e.target.value)} placeholder="e.g. INV-2041" />
        </Field>
      </div>
    </Card>
  );
}
