import React from 'react';
import { Plus, X } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Field, IconButton, TextInput } from '../../../components/ui';
import { formatCount } from '../../../utils/format';
import { CheckedInput, NumInput, SectionCard } from './fields';

const c = theme.colors;

// Product with Types — each colour/size with its own barcode and starting stock.
export function TypesSection({ types, baseUnitName, onAddType, onUpdateType, onRemoveType, onCheckBarcode, showErrors }) {
  return (
    <SectionCard title={glossary.types} intro="Add each colour or size as a Type, with its barcode and how many you have now.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        {types.map((t, i) => (
          <TypeRow
            key={t.id ?? `new-${i}`}
            type={t}
            index={i}
            baseUnitName={baseUnitName}
            onUpdate={onUpdateType}
            onRemove={onRemoveType}
            onCheckBarcode={onCheckBarcode}
            showErrors={showErrors}
          />
        ))}
      </div>
      <Button variant="tinted" icon={Plus} onClick={onAddType}>
        Add another Type
      </Button>
    </SectionCard>
  );
}

function TypeRow({ type: t, index, baseUnitName, onUpdate, onRemove, onCheckBarcode, showErrors }) {
  const label = t.variantName.trim() || `Type ${index + 1}`;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr) 34px',
        gap: theme.spacing.smd,
        alignItems: 'start',
        padding: `${theme.spacing.smd} ${theme.spacing.smd} 0`,
        border: `1px solid ${c.separator}`,
        borderRadius: theme.radius.md,
        backgroundColor: c.surfaceAlt,
      }}
    >
      <Field label="Type name">
        <TextInput
          value={t.variantName}
          onChange={(e) => onUpdate(index, { variantName: e.target.value })}
          placeholder="e.g. Red, Large"
          autoFocus={!t.id && !t.variantName && index > 0}
          aria-invalid={showErrors && !t.variantName.trim()}
        />
      </Field>
      <Field label="Barcode" error={t.barcodeError}>
        <CheckedInput
          scanner
          value={t.barcode}
          onChange={(e) => onUpdate(index, { barcode: e.target.value })}
          onBlur={() => onCheckBarcode(index)}
          checking={t.checking}
          placeholder="Optional"
        />
      </Field>
      {t.id ? (
        <div style={{ marginBottom: theme.spacing.md }}>
          <div style={{ ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, marginBottom: '6px' }}>In stock</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, minHeight: theme.control.input, flexWrap: 'wrap' }}>
            <span style={{ ...theme.type.body, ...theme.font.numeric, fontWeight: theme.font.weightSemibold }}>
              {formatCount(t.stockQty)} {baseUnitName}
            </span>
          </div>
        </div>
      ) : (
        <Field label={glossary.startingStock}>
          <NumInput allowDecimal={false} value={t.startingStock} onChange={(v) => onUpdate(index, { startingStock: v })} />
        </Field>
      )}
      <IconButton icon={X} tone="danger" label={`Remove ${label}`} onClick={() => onRemove(index)} style={{ marginTop: '25px' }} />
    </div>
  );
}
