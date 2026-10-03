import React, { memo } from 'react';
import theme from '../../../config/theme';
import { formatCount, formatCurrency } from '../../../utils/format';
import { Kbd } from '../../../components/ui';
import { BigSearchInput, InlineMessage, PanelTitle, c, keepFocus } from './common';

const LIST_ID = 'pos-item-list';
const optId = (i) => `pos-item-opt-${i}`;
// Used only when a product has no warn-below value of its own.
const DEFAULT_LOW_STOCK = 5;

export default function ItemSearchPanel({
  inputRef,
  query,
  onQueryChange,
  editingCart,
  results,
  highlight,
  activeSelector,
  typeIndex,
  unitIndex,
  saleType,
  message,
  actions,
}) {
  const open = results.length > 0;
  return (
    <>
      <PanelTitle
        title="Add items"
        hint={editingCart ? 'You are changing the items below. Press Esc to go back to the search box.' : 'Type a name or item code, or scan a barcode.'}
      />
      <BigSearchInput
        inputRef={inputRef}
        value={query}
        onChange={onQueryChange}
        disabled={editingCart}
        placeholder="Name, item code or barcode"
        label="Search products"
        listId={LIST_ID}
        activeId={optId(highlight)}
        expanded={open}
      />
      <InlineMessage tone="warning">{message}</InlineMessage>

      {open && (
        <div id={LIST_ID} role="listbox" aria-label="Products" style={styles.list} onMouseDown={keepFocus}>
          {results.map((group, idx) => {
            const hl = idx === highlight;
            return (
              <ResultRow
                key={group.productId}
                group={group}
                idx={idx}
                highlighted={hl}
                activeSelector={hl ? activeSelector : null}
                typeIndex={hl ? typeIndex : 0}
                unitIndex={hl ? unitIndex : -1}
                saleType={saleType}
                actions={actions}
              />
            );
          })}
        </div>
      )}
      {!open && query.trim() && !editingCart && (
        <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: theme.spacing.smd }}>No products match “{query.trim()}”.</div>
      )}
    </>
  );
}

const ResultRow = memo(function ResultRow({ group, idx, highlighted, activeSelector, typeIndex, unitIndex, saleType, actions }) {
  const hasTypes = group.types.length > 1;
  const type = group.types[typeIndex] || group.types[0];
  const code = [group.sku, type?.barcode].filter(Boolean).join(' · ');

  return (
    <div
      id={optId(idx)}
      role="option"
      aria-selected={highlighted}
      onClick={() => actions.onRowClick(idx)}
      style={{ ...styles.row, backgroundColor: highlighted ? c.accentTint : 'transparent' }}
    >
      <div style={styles.top}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ ...theme.type.headline, color: c.label }}>{group.productName}</div>
          {code && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{code}</div>}
        </div>
        <StockNote qty={type?.stockQty} unit={group.baseUnitName} limit={group.minStockAlert} />
      </div>

      <div style={styles.groups}>
        {hasTypes && (
          <ChipGroup label="Type" active={activeSelector === 'type'} showTab={highlighted}>
            {group.types.map((t, tIdx) => (
              <Chip
                key={t.variantId}
                selected={activeSelector === 'type' && tIdx === typeIndex}
                onClick={(e) => {
                  e.stopPropagation();
                  actions.onTypeClick(idx, tIdx);
                }}
              >
                {t.variantName}
              </Chip>
            ))}
          </ChipGroup>
        )}
        <ChipGroup label="Pack size" active={activeSelector === 'unit'} showTab={highlighted && hasTypes}>
          {group.units.map((u, uIdx) => (
            <Chip
              key={u.id}
              selected={activeSelector === 'unit' && uIdx === unitIndex}
              onClick={(e) => {
                e.stopPropagation();
                actions.onUnitClick(group, uIdx);
              }}
            >
              {u.unitName}
              <span style={theme.font.numeric}>{formatCurrency(saleType === 'wholesale' ? u.wholesalePrice : u.retailPrice)}</span>
            </Chip>
          ))}
        </ChipGroup>
      </div>
    </div>
  );
});

function StockNote({ qty, unit, limit }) {
  const n = Number(qty) || 0;
  const lowAt = Number(limit) > 0 ? Number(limit) : DEFAULT_LOW_STOCK;
  let color = c.labelSecondary;
  let text = `${formatCount(n)} ${unit || ''} in stock`;
  if (n <= 0) {
    color = c.redText;
    text = 'Out of stock';
  } else if (n <= lowAt) {
    color = c.orangeText;
    text = `Only ${formatCount(n)} left`;
  }
  return <div style={{ ...theme.type.footnote, ...theme.font.numeric, fontWeight: theme.font.weightMedium, color, whiteSpace: 'nowrap' }}>{text}</div>;
}

// The group the ←/→ keys currently change gets an accent ring and label.
function ChipGroup({ label, active, showTab, children }) {
  return (
    <div style={{ ...styles.group, boxShadow: active ? `0 0 0 2px ${c.accent}` : 'none', backgroundColor: active ? c.surface : 'transparent' }}>
      <span style={{ ...theme.type.caption, color: active ? c.accent : c.labelTertiary, textTransform: 'uppercase' }}>{label}</span>
      {children}
      {showTab && !active && (
        <span style={styles.tabHint}>
          <Kbd>Tab</Kbd>
        </span>
      )}
    </div>
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-pressed={selected}
      onClick={onClick}
      style={{
        ...styles.chip,
        backgroundColor: selected ? c.accent : c.fill,
        color: selected ? c.labelOnAccent : c.label,
        fontWeight: selected ? theme.font.weightSemibold : theme.font.weightMedium,
      }}
    >
      {children}
    </button>
  );
}

const styles = {
  list: { marginTop: theme.spacing.sm, overflowY: 'auto', minHeight: 0, flex: '0 1 auto', maxHeight: '560px' },
  row: { padding: '8px 12px', borderRadius: theme.radius.md, cursor: 'pointer', minHeight: '56px', boxSizing: 'border-box' },
  top: { display: 'flex', alignItems: 'flex-start', gap: theme.spacing.smd },
  groups: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: '6px' },
  group: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', padding: '3px 6px', borderRadius: theme.radius.sm },
  tabHint: { display: 'inline-flex', marginLeft: '2px' },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '26px',
    padding: '0 10px',
    border: 'none',
    borderRadius: theme.radius.pill,
    fontFamily: theme.font.family,
    ...theme.type.footnote,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
