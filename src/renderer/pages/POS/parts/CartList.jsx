import React, { memo, useEffect, useRef, useState } from 'react';
import { ScanBarcode, Trash2 } from 'lucide-react';
import theme from '../../../config/theme';
import { formatCurrency } from '../../../utils/format';
import { Card, EmptyState, IconButton, TextInput } from '../../../components/ui';
import { InlineMessage, Money, c, keepFocus, packSizeName, typeName } from './common';

export default function CartList({
  lines,
  stockIssues,
  selectedIndex,
  editingIndex,
  editingValue,
  onEditingChange,
  editInputRef,
  editingFocValue,
  onEditingFocChange,
  editFocInputRef,
  editingError,
  isAdmin,
  canRemove,
  active,
  actions,
}) {
  return (
    <Card padding="0" style={{ ...styles.card, borderColor: active ? c.accent : c.separator }}>
      <div style={styles.header}>
        <span style={{ ...theme.type.headline, color: c.label }}>Items ({lines.length})</span>
        {lines.length > 0 && (
          <span style={styles.cols} aria-hidden="true">
            <span style={styles.colQty}>Qty × Price</span>
            <span style={styles.colTotal}>Total</span>
            <span style={{ width: theme.control.md }} />
          </span>
        )}
      </div>

      {lines.length === 0 ? (
        <EmptyState icon={ScanBarcode} title="No items yet" message="Type a name or scan a barcode above." style={{ padding: '24px', margin: 'auto' }} />
      ) : (
        <div role="list" aria-label="Items in this sale" style={styles.list}>
          {lines.map((line, idx) => {
            const editing = idx === editingIndex;
            return (
              <CartRow
                key={line.key}
                line={line}
                idx={idx}
                selected={idx === selectedIndex}
                editing={editing}
                editValue={editing ? editingValue : null}
                editError={editing ? editingError : ''}
                onEditChange={onEditingChange}
                editInputRef={editing ? editInputRef : null}
                editFocValue={editing ? editingFocValue : null}
                onEditFocChange={onEditingFocChange}
                editFocInputRef={editing ? editFocInputRef : null}
                stockIssue={!!stockIssues[line.key]}
                isAdmin={isAdmin}
                canRemove={canRemove}
                actions={actions}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

const CartRow = memo(function CartRow({ line, idx, selected, editing, editValue, editError, onEditChange, editInputRef, editFocValue, onEditFocChange, editFocInputRef, stockIssue, isAdmin, canRemove, actions }) {
  const [hovered, setHovered] = useState(false);
  const rowRef = useRef(null);
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  const qty = Number(line.quantity) || 0;
  const foc = Number(line.focQuantity) || 0;
  const lineTotal = qty * (Number(line.unitPrice) || 0);
  const pack = packSizeName(line);
  const detail = [typeName(line.variantName), pack].filter(Boolean).join(' · ');

  return (
    <div
      ref={rowRef}
      role="listitem"
      aria-current={selected || undefined}
      onClick={() => actions.onRowClick(idx)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.row,
        backgroundColor: selected ? c.accentTint : hovered ? c.surfaceAlt : 'transparent',
        boxShadow: stockIssue ? `inset 3px 0 0 ${c.orange}` : 'none',
      }}
    >
      <div style={styles.main}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label }}>{line.productName}</div>
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>
            {detail}
            {isAdmin && (
              <span style={theme.font.numeric}>
                {' '}· Buying {formatCurrency(line.costPrice)} · Margin {formatCurrency(lineTotal - (qty + foc) * (Number(line.costPrice) || 0))}
              </span>
            )}
          </div>
        </div>

        <div style={styles.colQty}>
          {editing ? (
            <div style={{ display: 'flex', gap: theme.spacing.xs, alignItems: 'center' }}>
            <TextInput
              ref={editInputRef}
              type="number"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              aria-label={`Quantity for ${line.productName}`}
              aria-invalid={editError ? true : undefined}
              style={{ ...theme.font.numeric, textAlign: 'right', width: '80px' }}
            />
            <TextInput
              ref={editFocInputRef}
              type="number"
              min="0"
              value={editFocValue}
              onChange={(e) => onEditFocChange(e.target.value)}
              aria-label={`Free quantity for ${line.productName}`}
              placeholder="Free"
              style={{ ...theme.font.numeric, textAlign: 'right', width: '72px' }}
            />
            </div>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <Money value={`${line.quantity} × ${formatCurrency(line.unitPrice)}`} style={{ ...theme.type.subhead, color: c.labelSecondary }} />
              {foc > 0 && <div style={{ ...theme.type.caption, color: c.greenText }}>+ {foc} free</div>}
            </div>
          )}
        </div>
        <Money value={formatCurrency(lineTotal)} style={{ ...styles.colTotal, ...theme.type.headline, color: c.label }} />
        <span style={{ width: theme.control.md, display: 'inline-flex' }} onMouseDown={keepFocus}>
          {canRemove && !editing && hovered && (
            <IconButton
              icon={Trash2}
              label="Remove item"
              tone="danger"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                actions.onRemove(idx);
              }}
            />
          )}
        </span>
      </div>

      {editError && <InlineMessage tone="error">{editError}</InlineMessage>}
      {stockIssue && (
        <InlineMessage tone="warning">
          Not enough stock — only {line.stockQty} {line.baseUnitName} available.
        </InlineMessage>
      )}
    </div>
  );
});

const styles = {
  card: { flex: '1 1 0', minHeight: '140px', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderWidth: '1px', borderStyle: 'solid' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${c.separator}`,
    flexShrink: 0,
  },
  cols: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd, ...theme.type.caption, color: c.labelTertiary, textTransform: 'uppercase' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px' },
  row: { padding: '8px 8px', borderRadius: theme.radius.md, cursor: 'pointer', minHeight: '56px', boxSizing: 'border-box' },
  main: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd },
  colQty: { width: '170px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end' },
  colTotal: { width: '110px', textAlign: 'right', display: 'inline-block' },
};
