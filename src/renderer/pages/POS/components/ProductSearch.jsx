import React, { useRef, useState } from 'react';
import theme from '../../../config/theme';
import { formatCount } from '../../../utils/format';

// The same input handles both a barcode scanner (fast keystrokes ending in
// Enter) and manual typed search — on Enter we try an exact barcode match
// first, and only fall back to a text search if nothing matches.
export default function ProductSearch({ onAddVariant }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  function handleChange(e) {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 250);
  }

  async function runSearch(value) {
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const res = await window.api.sales.searchProducts({ query: value.trim() });
    setResults(res);
  }

  async function handleKeyDown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const value = query.trim();
    if (!value) return;

    const match = await window.api.sales.getVariantByBarcode({ barcode: value });
    if (match) {
      addAndClear(match.variantId);
      return;
    }
    runSearch(value);
  }

  function addAndClear(variantId) {
    onAddVariant(variantId);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>Products</div>
      <input
        ref={inputRef}
        autoFocus
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Scan barcode or search by name / SKU…"
        style={styles.input}
      />
      <div style={styles.results}>
        {results.map((r) => (
          <div
            key={r.variantId}
            style={styles.resultRow}
            onClick={() => addAndClear(r.variantId)}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div>
              <div style={styles.resultName}>
                {r.productName}
                {r.variantName !== 'Standard' ? ` — ${r.variantName}` : ''}
              </div>
              <div style={styles.resultMeta}>{r.sku || '—'}</div>
            </div>
            <div style={styles.resultStock}>
              {formatCount(r.stockQty)} {r.baseUnitName}
            </div>
          </div>
        ))}
        {query.trim() && results.length === 0 && <div style={styles.resultMeta}>No matches.</div>}
      </div>
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
  input: {
    width: '100%',
    padding: '14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeMd,
    boxSizing: 'border-box',
  },
  results: { marginTop: '10px', overflowY: 'auto', flex: 1, minHeight: 0 },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 10px',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    borderBottom: `1px solid ${theme.colors.border}`,
    transition: 'background-color 0.15s ease',
  },
  resultName: { color: theme.colors.textPrimary, fontSize: theme.font.sizeBase },
  resultMeta: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginTop: '2px' },
  resultStock: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm, whiteSpace: 'nowrap' },
};
