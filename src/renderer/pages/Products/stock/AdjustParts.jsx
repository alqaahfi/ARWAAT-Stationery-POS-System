import React from 'react';
import { CalendarX, ClipboardList, Ellipsis, PackageX, SearchX, Minus, Plus } from 'lucide-react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import glossary from '../../../config/glossary';
import { Button, ChipGroup, Field, FieldError, IconTile, NumberInput, SegmentedControl, TextArea } from '../../../components/ui';
import { formatCount } from '../../../utils/format';
import { wholeNumber } from '../../../utils/quantity';

const c = theme.colors;

// Plain labels + icons for the reason codes stock:get-adjustment-reasons returns.
const REASON_LOOK = {
  damaged: { label: 'Damaged', icon: PackageX },
  expired: { label: 'Expired', icon: CalendarX },
  lost: { label: 'Lost', icon: SearchX },
  recount: { label: 'Recount', icon: ClipboardList },
  other: { label: 'Other', icon: Ellipsis },
};

// Chosen item: name, code, big current stock, and the Type choice when the
// product has more than one.
export function SelectedItem({ product, variantId, onVariant, onChange }) {
  const variants = product.variants || [];
  const variant = variants.find((v) => v.id === variantId);
  const stock = variant ? variant.stock_qty : variants.reduce((s, v) => s + (Number(v.stock_qty) || 0), 0);
  const meta = [variant && variant.variant_name !== 'Standard' ? variant.variant_name : null, product.sku].filter(Boolean).join(' · ');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd }}>
        <IconTile {...appIcons.products} variant="soft" size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...theme.type.headline, color: c.label }}>{product.name}</div>
          {meta && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{meta}</div>}
        </div>
        <Button variant="plain" onClick={onChange}>
          Change
        </Button>
      </div>
      <div style={{ ...theme.type.title2, ...theme.font.numeric, color: c.label, marginTop: theme.spacing.smd }}>
        In stock: {formatCount(stock)} {product.base_unit_name}
        {!variant && variants.length > 1 && <span style={{ ...theme.type.footnote, color: c.labelSecondary }}> (all {glossary.types})</span>}
      </div>

      {variants.length > 1 && (
        <div style={{ marginTop: theme.spacing.md }}>
          <div id="adjust-type-label" style={{ ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, marginBottom: '6px' }}>
            Which Type?
          </div>
          <ChipGroup
            aria-label="Which Type?"
            value={variantId}
            onChange={onVariant}
            options={variants.map((v) => ({ value: v.id, label: `${v.variant_name} · ${formatCount(v.stock_qty)}` }))}
          />
        </div>
      )}
      {variants.length === 0 && <FieldError>This product has no active variants.</FieldError>}
    </div>
  );
}

export function ReasonChips({ reasons, value, onChange }) {
  return (
    <ChipGroup
      size="lg"
      aria-label="What happened?"
      value={value}
      onChange={onChange}
      options={reasons.map((r) => ({ value: r.code, label: REASON_LOOK[r.code]?.label || r.label, icon: REASON_LOOK[r.code]?.icon }))}
    />
  );
}

// Add/Remove + a positive amount, sent as today's { direction, quantity }.
export function AmountFields({ direction, onDirection, quantity, onQuantity, unitName, current, overLimit, note, onNote, onSubmit }) {
  const qty = Number(quantity) || 0;
  const removing = direction === 'decrease';
  const after = removing ? current - qty : current + qty;

  return (
    <div>
      <SegmentedControl
        label="Add or remove"
        value={direction}
        onChange={onDirection}
        options={[
          { value: 'increase', label: 'Add stock', icon: Plus },
          { value: 'decrease', label: 'Remove stock', icon: Minus },
        ]}
      />
      <Field label={unitName ? `Quantity (${unitName})` : 'Quantity'} style={{ marginTop: theme.spacing.md, maxWidth: '220px' }}>
        <NumberInput
          id="adjust-qty"
          value={quantity}
          aria-invalid={overLimit ? true : undefined}
          inputMode="numeric"
          onChange={(e) => onQuantity(wholeNumber(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
          placeholder="0"
        />
      </Field>
      {qty > 0 && current != null && (
        <div style={{ ...theme.type.body, ...theme.font.numeric, fontWeight: theme.font.weightSemibold, color: removing ? c.orangeText : c.greenText }}>
          Stock will change from {formatCount(current)} to {formatCount(after)}
        </div>
      )}
      {overLimit && (
        <div role="alert">
          <FieldError>{overLimit}</FieldError>
        </div>
      )}
      <Field label="Note (optional)" style={{ marginTop: theme.spacing.md, marginBottom: 0 }}>
        <TextArea id="adjust-note" value={note} onChange={(e) => onNote(e.target.value)} placeholder="Any extra detail worth recording" style={{ minHeight: '60px' }} />
      </Field>
    </div>
  );
}
