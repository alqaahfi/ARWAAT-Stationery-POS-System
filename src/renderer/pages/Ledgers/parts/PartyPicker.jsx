import React, { memo, useEffect, useId, useRef, useState } from 'react';
import { SearchX, UserSearch } from 'lucide-react';
import theme from '../../../config/theme';
import { Avatar, Badge, Card, EmptyState, SearchField, Skeleton } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { LoadError } from '../../Parties/PartyParts';

const c = theme.colors;

// Search-as-you-type customer/supplier finder over the existing
// searchMinimal handlers. ↑/↓ move, Enter picks, Esc clears.
// compact: smaller, for use inside a form (no big empty state, no card).
// showType adds the customer type badge; idleTitle/idleMessage reword the
// empty state shown before anything is typed.
export default function PartyPicker({ party, onPick, compact = false, autoFocus = true, showType = false, idleTitle, idleMessage }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [active, setActive] = useState(0);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);
  const listId = useId();

  const source = party === 'supplier' ? window.api.suppliers : window.api.customers;
  const noun = party === 'supplier' ? 'supplier' : 'customer';

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Switching customer <-> supplier starts over.
  useEffect(() => {
    setQuery('');
    setResults([]);
    setStatus('idle');
  }, [party]);

  async function search(text) {
    const id = ++requestRef.current;
    setStatus('loading');
    try {
      const rows = await source.searchMinimal({ search: text });
      if (id !== requestRef.current) return;
      setResults(rows || []);
      setActive(0);
      setStatus('ready');
    } catch {
      if (id === requestRef.current) setStatus('error');
    }
  }

  function onChange(value) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      requestRef.current++;
      setResults([]);
      setStatus('idle');
      return;
    }
    debounceRef.current = setTimeout(() => search(value.trim()), 250);
  }

  function pick(row) {
    if (!row) return;
    setQuery('');
    setResults([]);
    setStatus('idle');
    onPick(row);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + delta + results.length) % results.length);
    } else if (e.key === 'Enter') {
      // Never submit a surrounding form from the search box.
      e.preventDefault();
      if (status === 'ready') pick(results[active]);
    }
  }

  const showList = status === 'ready' && results.length > 0;
  const optionId = (i) => `${listId}-opt-${i}`;

  let body = null;
  if (status === 'loading') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.smd, padding: theme.spacing.md }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height="18px" />
        ))}
      </div>
    );
  } else if (status === 'error') {
    body = <LoadError message="The search didn't work." onRetry={() => search(query.trim())} />;
  } else if (status === 'ready' && !results.length) {
    body = <EmptyState icon={SearchX} title="No matches" message={`Try another name or phone number.`} style={compact ? { padding: '20px 16px' } : undefined} />;
  } else if (showList) {
    body = (
      <div id={listId} role="listbox" aria-label={`${noun} results`} style={{ maxHeight: compact ? '220px' : '420px', overflowY: 'auto', padding: '4px' }}>
        {results.map((row, i) => (
          <PickerOption
            key={row.id}
            id={optionId(i)}
            row={row}
            party={party}
            showType={showType}
            selected={i === active}
            onHover={() => setActive(i)}
            onPick={() => pick(row)}
          />
        ))}
      </div>
    );
  } else if (!compact) {
    body = (
      <EmptyState
        icon={UserSearch}
        title={idleTitle || `Choose a ${noun} to see their account`}
        message={idleMessage || 'Type part of a name or phone number.'}
      />
    );
  }

  const field = (
    <SearchField
      value={query}
      onChange={onChange}
      onKeyDown={onKeyDown}
      autoFocus={autoFocus}
      placeholder={`Search a ${noun} by name or phone`}
      aria-label={`Search a ${noun} by name or phone`}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={showList}
      aria-controls={showList ? listId : undefined}
      aria-activedescendant={showList ? optionId(active) : undefined}
      inputStyle={compact ? undefined : { height: '44px', ...theme.type.headline, fontWeight: theme.font.weightNormal }}
    />
  );

  if (compact) {
    return (
      <div>
        {field}
        {body && <div style={{ marginTop: theme.spacing.sm, border: `1px solid ${c.separator}`, borderRadius: theme.radius.md }}>{body}</div>}
      </div>
    );
  }

  return (
    <Card padding="0" style={{ overflow: 'hidden', maxWidth: '720px', width: '100%', margin: '0 auto' }}>
      <div style={{ padding: theme.spacing.md, borderBottom: body ? `1px solid ${c.separator}` : 'none' }}>{field}</div>
      {body}
    </Card>
  );
}

const PickerOption = memo(function PickerOption({ id, row, party, showType, selected, onHover, onPick }) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      onMouseDown={(e) => e.preventDefault()}
      onMouseMove={selected ? undefined : onHover}
      onClick={onPick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.smd,
        minHeight: '52px',
        padding: '6px 12px',
        boxSizing: 'border-box',
        borderRadius: theme.radius.sm,
        backgroundColor: selected ? c.accentTint : 'transparent',
        cursor: 'pointer',
      }}
    >
      <Avatar name={row.name} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.name}
        </div>
        {row.phone && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{row.phone}</div>}
      </div>
      {showType && row.customer_type && (
        <Badge size="sm" tone={row.customer_type === 'wholesale' ? 'purple' : 'blue'} style={{ textTransform: 'capitalize' }}>
          {row.customer_type}
        </Badge>
      )}
      <BalanceChip amount={row.balance_owed} party={party} />
    </div>
  );
});
