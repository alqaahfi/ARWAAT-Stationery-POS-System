import React, { memo, useEffect, useId, useRef, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import theme from '../../config/theme';
import { formatCount } from '../../utils/format';
import { Icon, SearchField, Spinner } from '../ui';

const c = theme.colors;

// Name / item code / barcode search used by both quick bills. Typing shows
// matches (Up/Down to move, Enter adds); an exact barcode (what a scanner
// types, ending in Enter) adds that item straight away.
export default function BillItemSearch({ onPick, disabled, autoFocus = true, inputId }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const requestRef = useRef(0);
  const listId = useId();

  useEffect(() => {
    const text = query.trim();
    if (!text) {
      requestRef.current++;
      setResults([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      const id = ++requestRef.current;
      try {
        const rows = await window.api.sales.searchProducts({ query: text });
        if (id !== requestRef.current) return;
        setResults(rows || []);
        setActive(0);
      } catch {
        if (id === requestRef.current) setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function reset() {
    requestRef.current++;
    setQuery('');
    setResults([]);
    setMessage('');
  }

  async function pick(row) {
    if (!row) return;
    reset();
    await onPick(row.variantId);
  }

  async function onEnter() {
    const text = query.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      // A scanned barcode is an exact match and skips the list.
      const exact = await window.api.sales.getVariantByBarcode({ barcode: text });
      if (exact) {
        await pick(exact);
        return;
      }
      if (results[active]) await pick(results[active]);
      else setMessage('Nothing matches that. Check the name, item code or barcode.');
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onEnter();
    }
  }

  const open = results.length > 0;
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
        <SearchField
          id={inputId}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setMessage('');
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder="Search by name or item code, or scan a barcode"
          aria-label="Search items"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          style={{ flex: 1 }}
          inputStyle={{ height: '44px' }}
        />
        {busy ? <Spinner size={18} /> : <Icon icon={ScanBarcode} size={20} style={{ color: c.labelTertiary }} />}
      </div>
      {message && (
        <div role="alert" style={{ ...theme.type.footnote, color: c.orangeText, marginTop: theme.spacing.xs }}>
          {message}
        </div>
      )}
      {open && (
        <div id={listId} role="listbox" aria-label="Matching items" style={styles.list}>
          {results.map((row, i) => (
            <ResultRow key={row.variantId} row={row} selected={i === active} onHover={() => setActive(i)} onPick={() => pick(row)} />
          ))}
        </div>
      )}
    </div>
  );
}

const ResultRow = memo(function ResultRow({ row, selected, onHover, onPick }) {
  const type = row.variantName && row.variantName !== 'Standard' ? row.variantName : null;
  const sub = [type, row.sku || row.barcode].filter(Boolean).join(' · ');
  return (
    <div
      role="option"
      aria-selected={selected}
      onMouseDown={(e) => e.preventDefault()}
      onMouseMove={selected ? undefined : onHover}
      onClick={onPick}
      style={{ ...styles.row, backgroundColor: selected ? c.accentTint : 'transparent' }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label }}>{row.productName}</div>
        {sub && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{sub}</div>}
      </div>
      <span style={{ ...theme.type.footnote, ...theme.font.numeric, color: row.stockQty <= 0 ? c.orangeText : c.labelSecondary }}>
        {formatCount(row.stockQty)} {row.baseUnitName || ''} in stock
      </span>
    </div>
  );
});

const styles = {
  list: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: theme.spacing.xs,
    maxHeight: '300px',
    overflowY: 'auto',
    padding: theme.spacing.xs,
    zIndex: 5,
    backgroundColor: c.surface,
    border: `1px solid ${c.separator}`,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadow.dropdown,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.smd,
    minHeight: '48px',
    padding: '6px 12px',
    boxSizing: 'border-box',
    borderRadius: theme.radius.sm,
    cursor: 'pointer',
  },
};
