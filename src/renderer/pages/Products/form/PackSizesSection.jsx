import React from 'react';
import { Check, Plus, X } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Field, FieldError, Icon, IconButton, SegmentedControl, TextInput } from '../../../components/ui';
import { formatCurrency } from '../../../utils/format';
import { NumInput, SectionCard, grid } from './fields';

const c = theme.colors;

export const PRESET_UNITS = ['Piece', 'Dozen', 'Box', 'Pack', 'Ream', 'Set', 'Carton', 'Sheet', 'Roll', 'Pair'];

// Section 3 — always open, at least one pack size required.
export function PackSizesSection({
  units,
  baseUnitName,
  error,
  showErrors,
  isPresetAdded,
  onTogglePreset,
  customUnitOpen,
  onOpenCustomUnit,
  customUnitName,
  onCustomUnitNameChange,
  onConfirmCustomUnit,
  onCancelCustomUnit,
  onUpdateUnit,
  onRemoveUnit,
  onSetDefaultUnit,
}) {
  return (
    <SectionCard title={`${glossary.packSizes} & prices`} intro="How do you sell this item? Add each pack size, like Piece, Dozen or Box.">
      <div role="group" aria-label="Add a pack size" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {PRESET_UNITS.map((preset) => (
          <PresetChip key={preset} label={preset} added={isPresetAdded(preset)} onClick={() => onTogglePreset(preset)} />
        ))}
        {!customUnitOpen && <PresetChip label="Custom" custom onClick={onOpenCustomUnit} />}
        {customUnitOpen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TextInput
              autoFocus
              aria-label="Custom pack size name"
              placeholder="e.g. Packet of 5"
              value={customUnitName}
              onChange={(e) => onCustomUnitNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onConfirmCustomUnit();
                } else if (e.key === 'Escape') {
                  e.stopPropagation();
                  onCancelCustomUnit();
                }
              }}
              style={{ width: '180px', height: theme.control.sm }}
            />
            <Button size="sm" onClick={onConfirmCustomUnit} disabled={!customUnitName.trim()}>
              Add
            </Button>
            <IconButton icon={X} size="sm" label="Cancel" onClick={onCancelCustomUnit} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.smd, marginTop: theme.spacing.md }}>
        {units.map((u, i) => (
          <PackSizeCard
            key={u.id ?? `new-${i}`}
            unit={u}
            index={i}
            baseUnitName={baseUnitName}
            canRemove={units.length > 1}
            showErrors={showErrors}
            onUpdate={onUpdateUnit}
            onRemove={onRemoveUnit}
            onSetDefault={onSetDefaultUnit}
          />
        ))}
      </div>
      {error && (
        <div role="alert" data-section-error="">
          <FieldError>{error}</FieldError>
        </div>
      )}
    </SectionCard>
  );
}

function PresetChip({ label, added, custom, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={custom ? undefined : !!added}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        height: theme.control.sm,
        padding: '0 12px',
        borderRadius: theme.radius.pill,
        border: custom ? `1px dashed ${c.separatorStrong}` : 'none',
        backgroundColor: added ? c.accentTint : custom ? 'transparent' : c.fill,
        color: added ? c.accent : c.label,
        fontFamily: theme.font.family,
        ...theme.type.subhead,
        fontWeight: theme.font.weightMedium,
        cursor: 'pointer',
        transition: `background-color ${theme.motion.fast} ease`,
      }}
    >
      <Icon icon={added ? Check : Plus} size={16} />
      {label}
    </button>
  );
}

function PackSizeCard({ unit: u, index, baseUnitName, canRemove, showErrors, onUpdate, onRemove, onSetDefault }) {
  const factor = Number(u.conversionFactor) || 0;
  const name = u.unitName.trim() || 'This pack size';
  const helper = factor > 0 ? `1 ${name} = ${factor} ${baseUnitName}` : `How many ${baseUnitName} are in one ${name}?`;
  const radioId = `default-unit-${index}`;
  const isTrade = u.pricingMethod === 'trade';

  return (
    <div
      style={{
        border: `1px solid ${u.isDefaultSaleUnit ? c.accent : c.separator}`,
        borderRadius: theme.radius.md,
        padding: `${theme.spacing.smd} ${theme.spacing.md} 0`,
        backgroundColor: c.surface,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd, marginBottom: theme.spacing.smd }}>
        <TextInput
          aria-label="Pack size name"
          value={u.unitName}
          onChange={(e) => onUpdate(index, { unitName: e.target.value })}
          placeholder="Pack size name"
          aria-invalid={!!showErrors && !u.unitName.trim()}
          style={{ ...theme.type.headline, maxWidth: '240px', height: theme.control.md }}
        />
        <label htmlFor={radioId} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...theme.type.subhead, color: c.label, cursor: 'pointer', marginLeft: 'auto' }}>
          <input
            id={radioId}
            type="radio"
            name="default-sale-unit"
            checked={!!u.isDefaultSaleUnit}
            onChange={() => onSetDefault(index)}
            style={{ width: '16px', height: '16px', margin: 0, accentColor: c.accent, cursor: 'pointer' }}
          />
          {glossary.sellsByDefault}
        </label>
        <IconButton icon={X} label={`Remove ${name}`} tone="danger" onClick={() => onRemove(index)} disabled={!canRemove} />
      </div>
      <div style={{ marginBottom: theme.spacing.smd }}>
        <SegmentedControl
          size="sm"
          label="Pricing method"
          value={u.pricingMethod || 'simple'}
          onChange={(v) => onUpdate(index, v === 'trade' && !u.tradePrice && u.retailPrice ? { pricingMethod: v, tradePrice: u.retailPrice } : { pricingMethod: v })}
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'trade', label: 'Trade Price' },
          ]}
        />
      </div>
      <div style={grid(150)}>
        <Field label={glossary.contains} hint={helper}>
          <NumInput value={u.conversionFactor} onChange={(v) => onUpdate(index, { conversionFactor: v })} />
        </Field>
        {isTrade ? (
          <>
            <Field label="Trade price">
              <NumInput value={u.tradePrice} onChange={(v) => onUpdate(index, { tradePrice: v })} />
            </Field>
            <Field label="Purchase discount %">
              <NumInput value={u.purchaseDiscount} placeholder="0" onChange={(v) => onUpdate(index, { purchaseDiscount: v })} />
            </Field>
            <Field label="Extra discount" hint={`${glossary.buyingPrice}: ${formatCurrency(u.costPrice)}`}>
              <NumInput value={u.extraDiscount} placeholder="0" onChange={(v) => onUpdate(index, { extraDiscount: v })} />
            </Field>
          </>
        ) : (
          <>
            <Field label={glossary.retailPrice}>
              <NumInput value={u.retailPrice} onChange={(v) => onUpdate(index, { retailPrice: v })} />
            </Field>
            <Field label={glossary.wholesalePrice}>
              <NumInput value={u.wholesalePrice} onChange={(v) => onUpdate(index, { wholesalePrice: v })} />
            </Field>
            <Field label={glossary.buyingPrice}>
              <NumInput value={u.costPrice} onChange={(v) => onUpdate(index, { costPrice: v })} />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}
