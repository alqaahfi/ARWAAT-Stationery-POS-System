import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PackageCheck, PackageMinus, PackagePlus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Button, Checkbox, EmptyState, IconButton, NumberInput, Select, Spinner, TextInput, useToast } from '../../components/ui';
import BillItemSearch from '../../components/billing/BillItemSearch';
import { purchasePriceFields, round2, tradeUnitCost } from '../../components/billing/billingUtils';
import { formatCount, formatCurrency } from '../../utils/format';
import { wholeNumber } from '../../utils/quantity';

const c = theme.colors;
const TRADE_FIELDS = ['tradePrice', 'purchaseDiscount', 'extraDiscount'];

const REASONS = [
  { code: 'damaged', label: 'Damaged / Broken' },
  { code: 'expired', label: 'Expired' },
  { code: 'lost', label: 'Lost / Stolen' },
  { code: 'recount', label: 'Stock Recount Correction' },
  { code: 'other', label: 'Other' },
];

let lineSeq = 0;

function makeLine(detail, unit, mode) {
  return {
    key: `${detail.variant.id}-${unit.id}-${++lineSeq}`,
    variantId: detail.variant.id,
    variantName: detail.variant.variantName,
    productName: detail.product.name,
    baseUnitName: detail.product.baseUnitName,
    stockQty: detail.variant.stockQty,
    units: detail.units,
    unitId: unit.id,
    conversionFactor: unit.conversionFactor,
    quantity: '',
    ...(mode === 'add' ? purchasePriceFields(unit) : {}),
  };
}

const baseQty = (l) => (Number(l.quantity) || 0) * (Number(l.conversionFactor) || 1);

// Add Stock / Delete Stock lines. With `productId` the form is focused on that
// one product (one row per Type, no search); without it the user searches and
// adds any number of products. Pricing boxes follow each pack size's setup:
// Simple = one buying price, Trade Price = trade price + two discounts.
export default function StockEntryForm({ mode, productId, onSaved, onCancel, onDirty }) {
  const { user } = useAuth();
  const toast = useToast();
  const isAdd = mode === 'add';
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(!!productId);
  const [reason, setReason] = useState('recount');
  const [note, setNote] = useState('');
  const [updatePrices, setUpdatePrices] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    onDirty?.(lines.some((l) => Number(l.quantity) > 0));
  }, [lines, onDirty]);

  // Focused mode: one row per Type of the product, default pack size.
  useEffect(() => {
    if (!productId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const full = await window.api.products.getById({ id: productId });
        const rows = [];
        for (const v of full?.variants || []) {
          const detail = await window.api.sales.getVariantForCart({ variantId: v.id });
          if (!detail?.defaultUnitId) continue;
          rows.push(makeLine(detail, detail.units.find((u) => u.id === detail.defaultUnitId), mode));
        }
        if (!cancelled) setLines(rows);
      } catch {
        if (!cancelled) setError("This product couldn't be opened.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, mode]);

  const addItem = useCallback(
    async (variantId) => {
      setError('');
      const detail = await window.api.sales.getVariantForCart({ variantId });
      if (!detail?.defaultUnitId) {
        toast.error('This item has no pack size set up.');
        return;
      }
      const unit = detail.units.find((u) => u.id === detail.defaultUnitId);
      const existing = linesRef.current.find((l) => l.variantId === detail.variant.id && l.unitId === unit.id);
      if (existing) {
        setLines((prev) => prev.map((l) => (l.key === existing.key ? { ...l, quantity: round2((Number(l.quantity) || 0) + 1) } : l)));
        return;
      }
      const line = { ...makeLine(detail, unit, mode), quantity: 1 };
      setLines((prev) => [...prev, line]);
    },
    [mode, toast]
  );

  const updateField = useCallback((key, field, value) => {
    setError('');
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, [field]: value };
        if (l.pricingMethod === 'trade' && TRADE_FIELDS.includes(field)) next.unitPrice = tradeUnitCost(next);
        return next;
      })
    );
  }, []);

  const updateUnit = useCallback(
    (key, unitId) => {
      setLines((prev) =>
        prev.map((l) => {
          if (l.key !== key) return l;
          const unit = l.units.find((u) => u.id === unitId);
          if (!unit) return l;
          const next = { ...l, unitId, conversionFactor: unit.conversionFactor };
          if (mode === 'add') {
            const fields = purchasePriceFields(unit);
            Object.assign(next, { tradePrice: undefined, purchaseDiscount: undefined, extraDiscount: undefined }, fields);
          }
          return next;
        })
      );
    },
    [mode]
  );

  const removeLine = useCallback((key) => setLines((prev) => prev.filter((l) => l.key !== key)), []);

  // Stock per variant after every row for it is applied (rows can share a Type).
  function stockAfter(line) {
    const sum = lines.filter((l) => l.variantId === line.variantId).reduce((s, l) => s + baseQty(l), 0);
    return line.stockQty + (isAdd ? sum : -sum);
  }

  const filled = lines.filter((l) => Number(l.quantity) > 0);
  const overdrawn = !isAdd && filled.some((l) => stockAfter(l) < -1e-9);
  const totalValue = isAdd ? round2(filled.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)) : 0;

  async function save() {
    if (savingRef.current) return;
    if (!filled.length) {
      setError(isAdd ? 'Enter a quantity for at least one product.' : 'Enter how many to remove for at least one product.');
      return;
    }
    if (overdrawn) {
      setError('One of the items has less stock than you are removing.');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const payload = {
        createdBy: user.id,
        note,
        lines: filled.map((l) => ({
          variantId: l.variantId,
          unitId: l.unitId,
          quantity: Number(l.quantity),
          ...(isAdd
            ? { pricing: l.pricingMethod === 'trade' ? { tradePrice: l.tradePrice, purchaseDiscount: l.purchaseDiscount, extraDiscount: l.extraDiscount } : { unitPrice: l.unitPrice } }
            : {}),
        })),
      };
      const res = isAdd ? await window.api.stock.add({ ...payload, updatePrices }) : await window.api.stock.remove({ ...payload, reasonCode: reason });
      if (!res?.success) {
        setError(res?.reason || 'Could not save the stock change.');
        return;
      }
      toast.success(isAdd ? 'Stock added' : 'Stock removed');
      onSaved?.();
    } catch {
      setError('Could not save the stock change. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const Accent = isAdd ? PackagePlus : PackageMinus;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, minHeight: 0 }}>
      {!productId && (
        <BillItemSearch onPick={addItem} disabled={saving} />
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: theme.spacing.xl }}>
          <Spinner size={22} />
        </div>
      ) : lines.length === 0 ? (
        <EmptyState icon={PackageCheck} title="No products yet" message="Search above or scan a barcode to add the first product." style={{ padding: '32px 24px' }} />
      ) : (
        <div style={styles.table}>
          <div style={{ ...styles.grid, ...styles.head }} aria-hidden="true">
            <span>Product</span>
            <span>Pack size</span>
            <span style={styles.right}>{isAdd ? 'Qty to add' : 'Qty to remove'}</span>
            <span style={styles.right}>Stock after</span>
            <span />
          </div>
          {lines.map((line) => (
            <Row
              key={line.key}
              line={line}
              isAdd={isAdd}
              after={stockAfter(line)}
              showName={!productId || lines.length > 1}
              onField={updateField}
              onUnit={updateUnit}
              onRemove={productId ? null : removeLine}
            />
          ))}
        </div>
      )}

      {isAdd ? (
        <Checkbox checked={updatePrices} onChange={(e) => setUpdatePrices(e.target.checked)} label="Save these buying prices on the products" />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, maxWidth: '320px' }}>
          <Select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      <TextInput aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

      {error && (
        <div role="alert" style={{ ...theme.type.subhead, color: c.redText }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
        <span style={{ ...theme.type.subhead, color: c.labelSecondary, ...theme.font.numeric }}>
          {filled.length} item{filled.length === 1 ? '' : 's'}
          {isAdd && totalValue > 0 ? ` · ${formatCurrency(totalValue)} at buying price` : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: theme.spacing.sm }}>
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button icon={Accent} onClick={save} disabled={saving || !filled.length} variant={isAdd ? 'primary' : 'dangerFilled'}>
            {saving ? 'Saving…' : isAdd ? 'Add stock' : 'Remove stock'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const Row = React.memo(function Row({ line, isAdd, after, showName, onField, onUnit, onRemove }) {
  const type = line.variantName && line.variantName !== 'Standard' ? line.variantName : null;
  const isTrade = isAdd && line.pricingMethod === 'trade';
  const bad = after < -1e-9;
  return (
    <div style={{ borderBottom: `1px solid ${c.separator}` }}>
      <div style={{ ...styles.grid, ...styles.row }}>
        <div style={{ minWidth: 0 }}>
          {showName && <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label }}>{line.productName}</div>}
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>
            {type ? `${type} · ` : ''}In stock {formatCount(line.stockQty)} {line.baseUnitName}
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
          aria-label={`Quantity for ${line.productName}`}
          value={line.quantity}
          placeholder="0"
          inputMode="numeric"
          onChange={(e) => onField(line.key, 'quantity', wholeNumber(e.target.value))}
          onFocus={(e) => e.target.select()}
          aria-invalid={bad ? true : undefined}
        />
        <span style={{ ...theme.type.body, ...theme.font.numeric, textAlign: 'right', color: bad ? c.redText : c.label }}>
          {formatCount(after)} <span style={{ color: c.labelSecondary }}>{line.baseUnitName}</span>
        </span>
        {onRemove ? <IconButton icon={Trash2} label={`Remove ${line.productName}`} tone="danger" onClick={() => onRemove(line.key)} /> : <span />}
      </div>
      {isAdd && !isTrade && (
        <div style={styles.priceRow}>
          <PriceInput label="Buying price" line={line} field="unitPrice" onField={onField} />
        </div>
      )}
      {isTrade && (
        <div style={styles.priceRow}>
          <PriceInput label="Trade price" line={line} field="tradePrice" onField={onField} />
          <PriceInput label="Purchase discount %" line={line} field="purchaseDiscount" onField={onField} />
          <PriceInput label="Extra discount" line={line} field="extraDiscount" onField={onField} />
          <span style={{ ...theme.type.footnote, color: c.labelSecondary }}>
            Unit cost <span style={{ ...theme.font.numeric, color: c.label, fontWeight: theme.font.weightSemibold }}>{formatCurrency(line.unitPrice)}</span>
          </span>
        </div>
      )}
    </div>
  );
});

function PriceInput({ label, line, field, onField }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
      <span style={{ ...theme.type.footnote, color: c.labelSecondary }}>{label}</span>
      <NumberInput
        aria-label={`${label} for ${line.productName}`}
        value={line[field] === 0 ? '' : line[field] ?? ''}
        placeholder="0"
        onChange={(e) => onField(line.key, field, e.target.value)}
        onFocus={(e) => e.target.select()}
        style={{ width: '104px' }}
      />
    </label>
  );
}

const styles = {
  table: { border: `1px solid ${c.separator}`, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: c.surface },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px 110px 120px 36px', gap: theme.spacing.sm, alignItems: 'center' },
  head: { ...theme.type.footnote, fontWeight: theme.font.weightSemibold, color: c.labelSecondary, padding: `0 ${theme.spacing.md}`, height: '32px', backgroundColor: c.surfaceAlt, borderBottom: `1px solid ${c.separator}` },
  row: { padding: `8px ${theme.spacing.md}` },
  priceRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.md, padding: `0 ${theme.spacing.md} 10px` },
  right: { textAlign: 'right' },
};
