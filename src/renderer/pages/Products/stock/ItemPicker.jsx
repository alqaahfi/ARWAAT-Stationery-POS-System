import React, { memo, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import theme from '../../../config/theme';
import { Icon, Kbd, Spinner } from '../../../components/ui';

const c = theme.colors;

// Search-and-pick box shared by Purchases and Fix Stock Count. The page passes
// its own search call (same IPC it always used) and a mapper that turns a
// result into { key, title, subtitle, stock }. The first result is highlighted,
// so typing or scanning a barcode and pressing Enter picks it.
export function ItemPicker({ id, label, placeholder, search, mapResult, onPick, debounceMs = 250, inputRef, autoFocus }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchedFor, setSearchedFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef(null);
  const seq = useRef(0);
  const ownRef = useRef(null);
  const ref = inputRef || ownRef;
  const listId = `${id}-list`;
  const optId = (i) => `${id}-opt-${i}`;

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (open && results.length) document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open, results]);

  // Returns the rows, or null when a newer search has already started.
  async function run(value) {
    const q = value.trim();
    const mine = ++seq.current;
    if (!q) {
      setResults([]);
      setSearchedFor('');
      setLoading(false);
      return [];
    }
    setLoading(true);
    let rows = [];
    try {
      rows = (await search(q)) || [];
    } catch {
      rows = [];
    }
    if (mine !== seq.current) return null;
    setResults(rows);
    setSearchedFor(q);
    setActive(0);
    setLoading(false);
    return rows;
  }

  function handleChange(value) {
    setQuery(value);
    setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => run(value), debounceMs);
  }

  function pick(row) {
    clearTimeout(timer.current);
    seq.current++;
    setQuery('');
    setResults([]);
    setSearchedFor('');
    setLoading(false);
    setOpen(false);
    onPick(row);
  }

  async function handleKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (!results.length) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + delta + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      if (q === searchedFor && !loading) {
        if (results[active]) pick(results[active]);
        return;
      }
      // Typed/scanned faster than the debounce: search now, take the first hit.
      clearTimeout(timer.current);
      const rows = await run(query);
      if (rows && rows[0]) pick(rows[0]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  }

  const q = query.trim();
  const showList = open && !!q;
  const noMatches = !loading && q === searchedFor && results.length === 0;

  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <label htmlFor={id} style={{ display: 'block', ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, marginBottom: '6px' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <Icon icon={Search} size={20} style={{ position: 'absolute', left: '12px', top: '50%', marginTop: '-10px', color: c.labelSecondary, pointerEvents: 'none' }} />
        <input
          ref={ref}
          id={id}
          data-ui-input=""
          type="text"
          role="combobox"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && results.length ? optId(active) : undefined}
          aria-label={label ? undefined : placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          style={{
            width: '100%',
            height: '44px',
            padding: '0 12px 0 42px',
            boxSizing: 'border-box',
            borderRadius: theme.radius.md,
            border: `1px solid ${c.separatorStrong}`,
            backgroundColor: c.surface,
            color: c.label,
            fontFamily: theme.font.family,
            fontSize: theme.font.sizeMd,
            outline: 'none',
          }}
        />
      </div>

      {showList && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: c.surface,
            borderRadius: theme.radius.md,
            boxShadow: theme.shadow.dropdown,
            zIndex: 20,
            overflow: 'hidden',
          }}
        >
          <div id={listId} role="listbox" aria-label="Matching items" style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {results.map((r, i) => (
              <PickerRow key={mapResult(r).key} id={optId(i)} item={mapResult(r)} active={i === active} onHover={() => setActive(i)} onPick={() => pick(r)} />
            ))}
          </div>
          {loading && !results.length && (
            <div style={note}>
              <Spinner size={16} /> Searching…
            </div>
          )}
          {noMatches && <div style={note}>No matches for “{q}”.</div>}
          <div
            aria-hidden="true"
            style={{ display: 'flex', gap: theme.spacing.md, padding: '6px 12px', borderTop: `1px solid ${c.separator}`, backgroundColor: c.surfaceAlt, ...theme.type.footnote, color: c.labelSecondary }}
          >
            <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> Choose</span>
            <span><Kbd>Enter</Kbd> Select</span>
            <span><Kbd>Esc</Kbd> Close</span>
          </div>
        </div>
      )}
    </div>
  );
}

const note = { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: '12px', ...theme.type.subhead, color: c.labelSecondary };

const PickerRow = memo(function PickerRow({ id, item, active, onHover, onPick }) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={onHover}
      onClick={onPick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.smd,
        minHeight: theme.control.row,
        padding: '6px 12px',
        boxSizing: 'border-box',
        cursor: 'pointer',
        backgroundColor: active ? c.accentTint : 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        {item.subtitle && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{item.subtitle}</div>}
      </div>
      {item.stock != null && (
        <div style={{ ...theme.type.subhead, ...theme.font.numeric, color: c.labelSecondary, whiteSpace: 'nowrap' }}>{item.stock}</div>
      )}
    </div>
  );
});
