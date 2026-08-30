import React, { useState } from 'react';
import theme from '../../../config/theme';
import { formatCurrency } from '../../../utils/format';

export default function Cart({ lines, stockIssues, isAdmin, onUpdateUnit, onUpdateQuantity, onUpdatePriceOverride, onRemove }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>Cart</div>
      {lines.length === 0 ? (
        <div style={styles.empty}>Cart is empty — search or scan an item to add it.</div>
      ) : (
        <div style={styles.lines}>
          {lines.map((line) => (
            <CartLine
              key={line.key}
              line={line}
              hasStockIssue={!!stockIssues[line.key]}
              isAdmin={isAdmin}
              onUpdateUnit={onUpdateUnit}
              onUpdateQuantity={onUpdateQuantity}
              onUpdatePriceOverride={onUpdatePriceOverride}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CartLine({ line, hasStockIssue, isAdmin, onUpdateUnit, onUpdateQuantity, onUpdatePriceOverride, onRemove }) {
  const [overriding, setOverriding] = useState(line.overridden);
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const lineTotal = quantity * unitPrice;
  const margin = lineTotal - quantity * (Number(line.costPrice) || 0);

  return (
    <div style={{ ...styles.line, ...(hasStockIssue ? styles.lineWarning : {}) }}>
      <div style={styles.lineTop}>
        <div style={styles.lineName}>
          {line.productName}
          {line.variantName !== 'Standard' ? ` — ${line.variantName}` : ''}
        </div>
        <button style={styles.removeBtn} onClick={() => onRemove(line.key)}>
          ✕
        </button>
      </div>

      <div style={styles.lineRow}>
        <select style={styles.unitSelect} value={line.unitId} onChange={(e) => onUpdateUnit(line.key, Number(e.target.value))}>
          {line.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.unitName}
            </option>
          ))}
        </select>

        <input
          type="number"
          style={styles.qtyInput}
          value={line.quantity}
          min={0}
          onChange={(e) => onUpdateQuantity(line.key, e.target.value)}
        />

        {overriding ? (
          <input
            type="number"
            style={styles.priceInput}
            value={line.unitPrice}
            onChange={(e) => onUpdatePriceOverride(line.key, e.target.value)}
            autoFocus
          />
        ) : (
          <div style={styles.priceDisplay}>{formatCurrency(unitPrice)}</div>
        )}

        {isAdmin && (
          <button style={styles.overrideToggle} title="Override price" onClick={() => setOverriding((v) => !v)}>
            ✎
          </button>
        )}

        <div style={styles.lineTotal}>{formatCurrency(lineTotal)}</div>
      </div>

      {hasStockIssue && (
        <div style={styles.stockWarning}>
          ⚠ Not enough stock — only {line.stockQty} {line.baseUnitName} available.
        </div>
      )}

      {isAdmin && (
        <div style={styles.marginRow}>
          Cost: {formatCurrency(line.costPrice)} · Margin: {formatCurrency(margin)}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    padding: theme.spacing.md,
    fontFamily: theme.font.family,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  header: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' },
  empty: { color: theme.colors.textSecondary, fontSize: theme.font.sizeBase, padding: '32px 10px', textAlign: 'center' },
  lines: { overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
  line: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: '10px 12px' },
  lineWarning: { borderColor: theme.colors.warning },
  lineTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  lineName: { color: theme.colors.textPrimary, fontSize: theme.font.sizeBase, fontWeight: theme.font.weightSemibold },
  removeBtn: { background: 'none', border: 'none', color: theme.colors.textSecondary, cursor: 'pointer', fontSize: theme.font.sizeBase },
  lineRow: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' },
  unitSelect: {
    padding: '6px 8px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeSm,
  },
  qtyInput: {
    width: '64px',
    padding: '6px 8px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeSm,
  },
  priceDisplay: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm, minWidth: '70px' },
  priceInput: {
    width: '80px',
    padding: '6px 8px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.primary}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeSm,
  },
  overrideToggle: {
    background: 'none',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    padding: '5px 8px',
    fontSize: theme.font.sizeXs,
  },
  lineTotal: { marginLeft: 'auto', color: theme.colors.textPrimary, fontWeight: theme.font.weightSemibold, fontSize: theme.font.sizeBase },
  stockWarning: { color: theme.colors.warning, fontSize: theme.font.sizeXs, marginTop: '6px' },
  marginRow: { color: theme.colors.textSecondary, fontSize: '11px', marginTop: '6px' },
};
