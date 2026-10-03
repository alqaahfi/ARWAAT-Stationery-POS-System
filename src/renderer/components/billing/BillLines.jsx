import React, { memo } from 'react';
import { ScanBarcode, Trash2 } from 'lucide-react';
import theme from '../../config/theme';
import { formatCount, formatCurrency } from '../../utils/format';
import { Card, EmptyState, IconButton, NumberInput, Select } from '../ui';
import { lineTotal, lineUnits } from './billingUtils';

const c = theme.colors;

// Same grid for the header and every row, so the columns always line up.
const GRID = 'minmax(0, 1fr) 128px 84px 76px 104px 104px 36px';

// The item list shared by the quick Sale and quick Purchase forms. A sale shows
// its resolved price (read-only); a purchase lets the buying price be typed.
export default function BillLines({ lines, kind, canSeeCost, stockIssues, onUnit, onField, onRemove }) {
  const isPurchase = kind === 'purchase';
  return (
    <Card padding="0" style={styles.card}>
      <div style={styles.titleBar}>
        <span style={{ ...theme.type.headline, color: c.label }}>Items ({lines.length})</span>
      </div>
      {lines.length === 0 ? (
        <EmptyState icon={ScanBarcode} title="No items yet" message="Search above or scan a barcode to add the first item." style={{ padding: '32px 24px', margin: 'auto' }} />
      ) : (
        <>
          <div style={{ ...styles.grid, ...styles.head }} aria-hidden="true">
            <span>Item</span>
            <span>Pack size</span>
            <span style={styles.right}>Qty</span>
            <span style={styles.right}>Free</span>
            <span style={styles.right}>{isPurchase ? 'Buying price' : 'Price'}</span>
            <span style={styles.right}>Total</span>
            <span />
          </div>
          <div role="list" aria-label={isPurchase ? 'Items in this purchase' : 'Items in this sale'} style={styles.list}>
            {lines.map((line) => (
              <BillRow
                key={line.key}
                line={line}
                isPurchase={isPurchase}
                canSeeCost={canSeeCost}
                stockIssue={!!stockIssues[line.key]}
                onUnit={onUnit}
                onField={onField}
                onRemove={onRemove}
              />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

const BillRow = memo(function BillRow({ line, isPurchase, canSeeCost, stockIssue, onUnit, onField, onRemove }) {
  const type = line.variantName && line.variantName !== 'Standard' ? line.variantName : null;
  const qty = Number(line.quantity) || 0;
  const foc = Number(line.focQuantity) || 0;
  const margin = lineTotal(line) - lineUnits(line) * (Number(line.costPrice) || 0);

  return (
    <div role="listitem" style={{ ...styles.rowWrap, boxShadow: stockIssue ? `inset 3px 0 0 ${c.orange}` : 'none' }}>
      <div style={{ ...styles.grid, ...styles.row }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label }}>{line.productName}</div>
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>
            {type || line.baseUnitName}
            {!isPurchase && canSeeCost && (
              <span style={theme.font.numeric}>
                {' '}· Buying {formatCurrency(line.costPrice)} · Margin {formatCurrency(margin)}
              </span>
            )}
          </div>
        </div>
        {line.units.length > 1 ? (
          <Select aria-label={`Pack size for ${line.productName}`} value={line.unitId} onChange={(e) => onUnit(line.key, Number(e.target.value))}>
            {line.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitName}
              </option>
            ))}
          </Select>
        ) : (
          <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>{line.units[0]?.unitName || line.baseUnitName}</span>
        )}
        <NumberInput
          id={`bill-qty-${line.key}`}
          aria-label={`Quantity for ${line.productName}`}
          value={line.quantity}
          onChange={(e) => onField(line.key, 'quantity', e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-invalid={qty <= 0 ? true : undefined}
        />
        <NumberInput
          aria-label={`Free quantity for ${line.productName}`}
          value={line.focQuantity === 0 ? '' : line.focQuantity}
          placeholder="0"
          onChange={(e) => onField(line.key, 'focQuantity', e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        {isPurchase ? (
          <NumberInput
            aria-label={`Buying price for ${line.productName}`}
            value={line.unitPrice}
            onChange={(e) => onField(line.key, 'unitPrice', e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        ) : (
          <span style={{ ...theme.type.body, ...theme.font.numeric, color: c.labelSecondary, textAlign: 'right' }}>{formatCurrency(line.unitPrice)}</span>
        )}
        <span style={{ ...theme.type.headline, ...theme.font.numeric, color: c.label, textAlign: 'right' }}>{formatCurrency(lineTotal(line))}</span>
        <IconButton icon={Trash2} label={`Remove ${line.productName}`} tone="danger" onClick={() => onRemove(line.key)} />
      </div>
      {foc > 0 && (
        <div style={{ ...theme.type.caption, color: c.greenText, padding: '0 8px 4px' }}>
          + {formatCount(foc)} free (not charged{isPurchase ? '' : ', still leaves your stock'})
        </div>
      )}
      {stockIssue && (
        <div role="alert" style={{ ...theme.type.footnote, color: c.orangeText, padding: '0 8px 4px' }}>
          Not enough stock — only {formatCount(line.stockQty)} {line.baseUnitName} available.
        </div>
      )}
    </div>
  );
});

const styles = {
  card: { flex: 1, minHeight: '160px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  titleBar: { padding: '12px 16px', borderBottom: `1px solid ${c.separator}`, flexShrink: 0 },
  grid: { display: 'grid', gridTemplateColumns: GRID, columnGap: theme.spacing.sm, alignItems: 'center' },
  head: {
    padding: '6px 16px',
    ...theme.type.caption,
    color: c.labelTertiary,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${c.separator}`,
    flexShrink: 0,
  },
  right: { textAlign: 'right' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px' },
  rowWrap: { borderBottom: `1px solid ${c.separator}` },
  row: { padding: '8px 8px', minHeight: '56px' },
};
