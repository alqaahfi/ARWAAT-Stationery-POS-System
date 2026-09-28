import React, { memo, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Card, FieldError, IconButton, NumberInput, Select } from '../../../components/ui';
import { formatCount, formatCurrency } from '../../../utils/format';
import { ItemPicker } from './ItemPicker';

const c = theme.colors;
const GRID = 'minmax(0, 1fr) 130px 90px 120px 110px 34px';
const head = { ...theme.type.footnote, fontWeight: theme.font.weightSemibold, color: c.labelSecondary };

// "Items (n)" card: the picker on top, then one grid row per purchase line.
export function PurchaseLines({ lines, lineTotal, errors, itemsError, focusLineKey, pickerRef, pickerProps, onUnit, onField, onRemove }) {
  return (
    <Card title={`Items (${lines.length})`} style={{ marginBottom: theme.spacing.md }}>
      <ItemPicker id="purchase-item-search" inputRef={pickerRef} placeholder="Type a name or item code, or scan a barcode" {...pickerProps} />
      {itemsError && (
        <div role="alert">
          <FieldError>{itemsError}</FieldError>
        </div>
      )}

      {lines.length === 0 ? (
        <div style={{ ...theme.type.subhead, color: c.labelSecondary, padding: `${theme.spacing.lg} 0 ${theme.spacing.sm}`, textAlign: 'center' }}>
          No items yet — search above to add the first one.
        </div>
      ) : (
        <div style={{ marginTop: theme.spacing.md }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: theme.spacing.sm, alignItems: 'end', paddingBottom: '6px', borderBottom: `1px solid ${c.separator}` }}>
            <span style={head}>Item</span>
            <span style={head}>{glossary.packSize}</span>
            <span style={{ ...head, textAlign: 'right' }}>Quantity</span>
            <span style={{ ...head, textAlign: 'right' }}>
              {glossary.buyingPrice}
              <span style={{ display: 'block', ...theme.type.caption, fontWeight: 400 }}>For this purchase only</span>
            </span>
            <span style={{ ...head, textAlign: 'right' }}>Line total</span>
            <span />
          </div>
          {lines.map((l) => (
            <LineRow
              key={l.key}
              line={l}
              total={lineTotal(l)}
              error={errors[l.key]}
              autoFocus={focusLineKey === l.key}
              pickerRef={pickerRef}
              onUnit={onUnit}
              onField={onField}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

const LineRow = memo(function LineRow({ line: l, total, error = {}, autoFocus, pickerRef, onUnit, onField, onRemove }) {
  const qtyRef = useRef(null);
  const costRef = useRef(null);

  useEffect(() => {
    if (autoFocus) {
      qtyRef.current?.focus();
      qtyRef.current?.select();
    }
  }, [autoFocus]);

  const typeName = l.variantName !== 'Standard' ? l.variantName : null;
  const meta = [typeName, l.sku].filter(Boolean).join(' · ');
  const added = (Number(l.quantity) || 0) * (Number(l.conversionFactor) || 0);

  return (
    <div style={{ padding: `${theme.spacing.smd} 0`, borderBottom: `1px solid ${c.separator}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: theme.spacing.sm, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label }}>{l.productName}</div>
          <div style={{ ...theme.type.footnote, color: c.labelSecondary, ...theme.font.numeric }}>
            {meta}
            {l.stockQty != null && `${meta ? ' · ' : ''}In stock now: ${formatCount(l.stockQty)}`}
          </div>
        </div>
        <Select aria-label={`${glossary.packSize} for ${l.productName}`} value={l.unitId} onChange={(e) => onUnit(l.key, Number(e.target.value))}>
          {l.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitName}
            </option>
          ))}
        </Select>
        <NumberInput
          ref={qtyRef}
          id={`pl-qty-${l.key}`}
          aria-label={`Quantity of ${l.productName}`}
          aria-invalid={!!error.quantity}
          value={l.quantity}
          onChange={(e) => onField(l.key, 'quantity', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              costRef.current?.focus();
              costRef.current?.select();
            }
          }}
        />
        <NumberInput
          ref={costRef}
          id={`pl-cost-${l.key}`}
          aria-label={`${glossary.buyingPrice} for ${l.productName}`}
          aria-invalid={!!error.unitCost}
          value={l.unitCost ?? ''}
          onChange={(e) => onField(l.key, 'unitCost', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              pickerRef.current?.focus();
            }
          }}
        />
        <div style={{ ...theme.type.body, ...theme.font.numeric, fontWeight: theme.font.weightSemibold, textAlign: 'right', color: c.label }}>
          {formatCurrency(total)}
        </div>
        <IconButton icon={X} label={`Remove ${l.productName}`} onClick={() => onRemove(l.key)} />
      </div>
      <div style={{ ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, marginTop: '4px' }}>
        = {formatCount(added)} {l.baseUnitName} will be added
      </div>
      {(error.quantity || error.unitCost) && (
        <div role="alert">
          <FieldError>{error.quantity || error.unitCost}</FieldError>
        </div>
      )}
    </div>
  );
});
