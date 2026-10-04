import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import theme from '../config/theme';
import appIcons from '../config/appIcons';
import glossary from '../config/glossary';
import { visibleSections, visibleTabs, canSee } from '../config/navConfig';
import { useAuth } from '../context/AuthContext';
import { Badge, Icon, IconTile, Kbd, MenuHeader, Spinner } from '../components/ui';
import { formatCurrency } from '../utils/format';

const c = theme.colors;
const DEBOUNCE_MS = 250;
const MAX_PAGE_MATCHES = 8;

// Every page a user may jump to (no edit/detail pages — those need an id).
function buildPages(user, hasPermission) {
  const pages = [];
  if (hasPermission('make_sale')) pages.push({ label: glossary.newSale, route: '/pos', icon: appIcons.sell });
  for (const s of visibleSections(user, hasPermission)) {
    const icon = appIcons[s.icon] || appIcons.home;
    const tabs = visibleTabs(s, user, hasPermission);
    for (const t of tabs) pages.push({ label: t.label, hint: t.label === s.label ? null : s.label, route: t.route, icon });
    if (!s.tabs.length) pages.push({ label: s.label, route: s.route, icon });
    for (const p of s.pages) {
      if (!p.needsParams && canSee(p, user, hasPermission)) pages.push({ label: p.label, hint: s.label, route: p.route, icon });
    }
  }
  return pages;
}

function balanceBadge(amount) {
  return <Badge tone={amount > 0 ? 'red' : 'green'} size="sm">{formatCurrency(amount)}</Badge>;
}

// Spotlight-style search: pages first, then products/customers/suppliers
// from the existing global:search IPC. ↑/↓ move, Enter opens, Esc closes.
export default function SearchPalette({ open, onClose, onNavigate }) {
  if (!open) return null;
  return <Palette onClose={onClose} onNavigate={onNavigate} />;
}

function Palette({ onClose, onNavigate }) {
  const { user, hasPermission } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const requestRef = useRef(0);
  const debounceRef = useRef(null);

  const allPages = useMemo(() => buildPages(user, hasPermission), [user, hasPermission]);

  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    return () => {
      clearTimeout(debounceRef.current);
      previous?.focus?.();
    };
  }, []);

  function onQueryChange(value) {
    setQuery(value);
    setActive(0);
    clearTimeout(debounceRef.current);
    const q = value.trim();
    const id = ++requestRef.current;
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await window.api.global.search({ query: q });
      if (id !== requestRef.current) return;
      setResults(res);
      setLoading(false);
    }, DEBOUNCE_MS);
  }

  function go(route, params) {
    onClose();
    onNavigate(route, params);
  }

  // Flat list of groups -> items, each item with a `run`.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pageItems = (q ? allPages.filter((p) => `${p.label} ${p.hint || ''}`.toLowerCase().includes(q)).slice(0, MAX_PAGE_MATCHES) : allPages).map((p) => ({
      key: `page-${p.route}`,
      label: p.label,
      hint: p.hint,
      tile: p.icon,
      run: () => go(p.route),
    }));
    const list = [{ title: q ? 'Pages' : 'Go to', items: pageItems }];
    if (q && results) {
      list.push({
        title: glossary.products,
        items: results.products.map((p) => ({
          key: `p-${p.id}`,
          label: p.name,
          hint: p.sku || p.category_name || null,
          tile: appIcons.products,
          run: () => go('/products/profile', { id: p.id }),
        })),
      });
      list.push({
        title: glossary.customers,
        items: results.customers.map((cu) => ({
          key: `c-${cu.id}`,
          label: cu.name,
          tile: appIcons.customers,
          trailing: balanceBadge(cu.balance_owed),
          run: () => go('/ledgers/customers', { id: cu.id, name: cu.name }),
        })),
      });
      list.push({
        title: glossary.suppliers,
        items: results.suppliers.map((s) => ({
          key: `s-${s.id}`,
          label: s.name,
          tile: appIcons.suppliers,
          trailing: balanceBadge(s.balance_owed),
          run: () => go('/ledgers/suppliers', { id: s.id, name: s.name }),
        })),
      });
    }
    return list.filter((g) => g.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, results, allPages]);

  const flat = groups.flatMap((g) => g.items);
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function onKeyDown(e) {
    // Keep keys away from page-level listeners (e.g. Cashier Mode).
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flat.length) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + delta + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flat[activeIndex]?.run();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  }

  let index = -1;
  const q = query.trim();

  return createPortal(
    <div
      data-search-palette=""
      onKeyDown={onKeyDown}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={styles.scrim}
    >
      <div role="dialog" aria-modal="true" aria-label="Search" style={styles.sheet}>
        <div style={styles.inputRow}>
          <Icon icon={Search} size={20} style={{ color: c.labelSecondary }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search pages, products, customers, suppliers…"
            aria-label="Search"
            aria-controls="search-palette-list"
            aria-activedescendant={flat.length ? `search-palette-${activeIndex}` : undefined}
            style={styles.input}
          />
          {loading && <Spinner size={16} style={{ color: c.labelSecondary }} />}
        </div>

        <div ref={listRef} id="search-palette-list" role="listbox" style={styles.list}>
          {groups.map((g) => (
            <div key={g.title}>
              <MenuHeader>{g.title}</MenuHeader>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                const selected = i === activeIndex;
                return (
                  <div
                    key={item.key}
                    id={`search-palette-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => active !== i && setActive(i)}
                    onClick={item.run}
                    style={{ ...styles.row, backgroundColor: selected ? c.accentTint : 'transparent' }}
                  >
                    <IconTile icon={item.tile.icon} color={item.tile.color} size="sm" variant="soft" />
                    <span style={styles.rowLabel}>{item.label}</span>
                    {item.hint && <span style={styles.rowHint}>{item.hint}</span>}
                    {item.trailing}
                  </div>
                );
              })}
            </div>
          ))}
          {q && !loading && results && flat.length === 0 && <div style={styles.empty}>No results for “{q}”.</div>}
        </div>

        <div style={styles.footer}>
          <span style={styles.footHint}><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span style={styles.footHint}><Kbd>Enter</Kbd> open</span>
          <span style={styles.footHint}><Kbd>Esc</Kbd> close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

const styles = {
  scrim: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    backgroundColor: c.scrim,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: '12vh',
    animation: `fade-in ${theme.motion.fast} ease`,
  },
  sheet: {
    width: '560px',
    maxWidth: 'calc(100% - 48px)',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: c.surface,
    borderRadius: theme.radius.xl,
    boxShadow: theme.shadow.modal,
    overflow: 'hidden',
    fontFamily: theme.font.family,
    animation: `pop-in ${theme.motion.base} ${theme.motion.easing}`,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.smd,
    padding: '0 18px',
    height: '56px',
    borderBottom: `1px solid ${c.separator}`,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: c.label,
    fontFamily: theme.font.family,
    ...theme.type.title2,
    fontWeight: theme.font.weightNormal,
  },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px 8px' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    height: theme.control.row,
    padding: '0 10px',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
  },
  rowLabel: { ...theme.type.body, fontWeight: theme.font.weightMedium, color: c.label, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rowHint: { ...theme.type.footnote, color: c.labelSecondary, whiteSpace: 'nowrap', flexShrink: 0 },
  empty: { ...theme.type.subhead, color: c.labelSecondary, padding: '20px', textAlign: 'center' },
  footer: {
    display: 'flex',
    gap: theme.spacing.md,
    padding: '8px 18px',
    borderTop: `1px solid ${c.separator}`,
    backgroundColor: c.surfaceAlt,
    flexShrink: 0,
  },
  footHint: { display: 'inline-flex', alignItems: 'center', gap: '3px', ...theme.type.footnote, color: c.labelSecondary },
};
