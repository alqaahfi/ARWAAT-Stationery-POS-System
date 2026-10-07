import React from 'react';
import { Plus, X } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Field, IconButton, Label, TextInput } from '../../../components/ui';
import { formatCount } from '../../../utils/format';
import { CheckedInput, NumInput, SectionCard } from './fields';
import UrduSuggestions from './UrduSuggestions';

const c = theme.colors;

// Product with Types — each colour/size with its own barcode and starting stock.
export function TypesSection({ types, baseUnitName, onAddType, onUpdateType, onRemoveType, onCheckBarcode, onAutoUrdu, showErrors }) {
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
            onAutoUrdu={onAutoUrdu}
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

function TypeRow({ type: t, index, baseUnitName, onUpdate, onRemove, onCheckBarcode, onAutoUrdu, showErrors }) {
  const label = t.variantName.trim() || `Type ${index + 1}`;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.1fr) minmax(0, 0.9fr) 34px',
        gap: theme.spacing.smd,
        alignItems: 'start',
        padding: `${theme.spacing.smd} ${theme.spacing.smd} 0`,
        border: `1px solid ${c.separator}`,
        borderRadius: theme.radius.md,
        backgroundColor: c.surfaceAlt,
      }}
    >
      <div style={{ marginBottom: theme.spacing.md }}>
        <Label htmlFor={`type-name-${index}`} style={{ marginTop: 0 }}>Type name</Label>
        <div style={{ display: 'flex', gap: theme.spacing.xs, alignItems: 'stretch' }}>
          <TextInput
            id={`type-name-${index}`}
            dir="auto"
            value={t.variantName}
            onChange={(e) => onUpdate(index, { variantName: e.target.value })}
            placeholder="e.g. Red, Large"
            autoFocus={!t.id && !t.variantName && index > 0}
            aria-invalid={showErrors && !t.variantName.trim()}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Button variant="tinted" size="md" loading={t.translating} disabled={!t.variantName.trim()} onClick={() => onAutoUrdu(index)} style={{ flexShrink: 0 }}>
            Auto Urdu Name
          </Button>
        </div>
        <UrduSuggestions words={t.urduWords} name={t.variantName} onPick={(v) => onUpdate(index, { variantName: v })} />
        <TextInput
          value={t.searchAlias || ''}
          onChange={(e) => onUpdate(index, { searchAlias: e.target.value })}
          placeholder="Search spelling (English)"
          aria-label="Search spelling (English)"
          style={{ background: c.fill, marginTop: theme.spacing.xs }}
        />
      </div>
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
