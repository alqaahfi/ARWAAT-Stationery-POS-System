import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Button, Stepper, useConfirm, useToast } from '../../components/ui';
import { formatCurrencyExact } from '../../utils/format';
import { computeRange } from '../Reports/components/DateRangePicker';
import { StickyActions } from '../Products/form/StickyActions';
import { LoadErrorCard, ReturnsEmpty, ReturnsSummary, ReturnsTable, ReturnsToolbar } from './parts/returns/ReturnsList';
import { ReturnDetailSheet } from './parts/returns/ReturnDetailSheet';
import { FindSaleStep } from './parts/returns/FindSaleStep';
import { ItemsStep } from './parts/returns/ItemsStep';
import { RefundStep } from './parts/returns/RefundStep';
import { ReturnSuccess } from './parts/returns/ReturnSuccess';
import { cashCap, cleanQty, formatQty, previewTotal, round2 } from './parts/returns/returnUtils';

const c = theme.colors;
const PAGE_SIZE = 50;
const STEPS = ['Find sale', 'Items', 'Refund'];

const defaultRange = () => ({ preset: 'this_year', ...computeRange('this_year') });

// Route: /sales/returns (Admin only — every returns handler re-checks).
// params.saleId starts a new return for that sale; params.returnId opens
// that return's detail over the list.
export default function Returns({ params = {}, onNavigate }) {
  const [mode, setMode] = useState(params.saleId ? 'flow' : 'list');
  const [flowKey, setFlowKey] = useState(0);

  function startNew() {
    setFlowKey((k) => k + 1);
    setMode('flow');
  }

  if (mode === 'flow') {
    return (
      <NewReturnFlow
        key={flowKey}
        startSaleId={flowKey === 0 ? params.saleId : null}
        onExit={() => setMode('list')}
        onOpenSale={(saleId) => onNavigate('/sales', { saleId })}
      />
    );
  }
  return <ReturnsListView initialReturnId={params.returnId} onNew={startNew} onOpenSale={(saleId) => onNavigate('/sales', { saleId })} />;
}

// ---------------- list ----------------

function ReturnsListView({ initialReturnId, onNew, onOpenSale }) {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState(defaultRange);
  const [result, setResult] = useState({ rows: [], total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [anyReturns, setAnyReturns] = useState(true);
  const [openId, setOpenId] = useState(initialReturnId || null);
  const [detail, setDetail] = useState({ loading: true, error: null, data: null });

  const requestRef = useRef(0);
  const debounceRef = useRef(null);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function onSearch(value) {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value.trim()), 300);
  }

  const query = useCallback(
    (offset) => ({ requestingUserId: user.id, search, dateFrom: range.dateFrom, dateTo: range.dateTo, limit: PAGE_SIZE, offset }),
    [user.id, search, range.dateFrom, range.dateTo]
  );

  const load = useCallback(async () => {
    const id = ++requestRef.current;
    setLoading(true);
    setError(false);
    try {
      const res = await window.api.returns.list(query(0));
      if (id !== requestRef.current) return;
      if (!res?.success) throw new Error(res?.reason);
      setResult(res);
      if (res.total === 0) {
        const probe = await window.api.returns.list({ requestingUserId: user.id, limit: 1 });
        if (id === requestRef.current) setAnyReturns(!!probe?.total);
      } else {
        setAnyReturns(true);
      }
    } catch {
      if (id === requestRef.current) setError(true);
    }
    if (id === requestRef.current) setLoading(false);
  }, [query, user.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    const id = requestRef.current;
    setLoadingMore(true);
    try {
      const res = await window.api.returns.list(query(result.rows.length));
      if (id === requestRef.current && res?.success) setResult((prev) => ({ ...res, rows: [...prev.rows, ...res.rows] }));
    } catch {
      // The button stays; the user can try again.
    }
    setLoadingMore(false);
  }

  const loadDetail = useCallback(async () => {
    if (!openId) return;
    setDetail({ loading: true, error: null, data: null });
    try {
      const res = await window.api.returns.getDetail({ id: openId, requestingUserId: user.id });
      if (!res?.success) setDetail({ loading: false, error: res?.notFound ? 'notFound' : 'failed', data: null });
      else setDetail({ loading: false, error: null, data: res });
    } catch {
      setDetail({ loading: false, error: 'failed', data: null });
    }
  }, [openId, user.id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  function clearFilters() {
    clearTimeout(debounceRef.current);
    setSearchInput('');
    setSearch('');
    setRange(defaultRange());
  }

  let content;
  if (error) {
    content = <LoadErrorCard message="Couldn't load returns." onRetry={load} />;
  } else if (!loading && result.rows.length === 0) {
    content = <ReturnsEmpty anyReturns={anyReturns} onNew={onNew} onClear={clearFilters} />;
  } else {
    content = (
      <>
        {!loading && <ReturnsSummary total={result.total} />}
        <ReturnsTable rows={result.rows} loading={loading} onOpen={(r) => setOpenId(r.id)} onOpenSale={onOpenSale} />
        {!loading && result.hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: theme.spacing.smd }}>
            <Button variant="plain" onClick={loadMore} loading={loadingMore}>
              Show more returns
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ paddingBottom: theme.spacing.xxl }}>
      <p style={styles.intro}>Items customers brought back, and what you gave them for them.</p>
      <ReturnsToolbar search={searchInput} onSearch={onSearch} range={range} onRange={setRange} onNew={onNew} />
      {content}
      {openId && (
        <ReturnDetailSheet
          state={detail}
          onClose={() => setOpenId(null)}
          onRetry={loadDetail}
          onOpenSale={(saleId) => {
            setOpenId(null);
            onOpenSale(saleId);
          }}
        />
      )}
    </div>
  );
}

// ---------------- new return flow ----------------

function NewReturnFlow({ startSaleId, onExit, onOpenSale }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [step, setStep] = useState(startSaleId ? 1 : 0);

  // Step 1 — finder
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [picking, setPicking] = useState(!!startSaleId);
  const [findMessage, setFindMessage] = useState(null);
  const searchRef = useRef(0);
  const debounceRef = useRef(null);

  // Steps 2–3
  const [data, setData] = useState(null);
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [restock, setRestock] = useState(true);
  const [refundMode, setRefundMode] = useState('cash');
  const [cashInput, setCashInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const runSearch = useCallback(
    async (text) => {
      const id = ++searchRef.current;
      if (!text) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      setSearchError(false);
      try {
        const res = await window.api.sales.list({ requestingUserId: user.id, search: text, limit: 20 });
        if (id !== searchRef.current) return;
        if (!res?.success) throw new Error(res?.reason);
        setResults(res.rows);
        setHighlight(0);
      } catch {
        if (id === searchRef.current) setSearchError(true);
      }
      if (id === searchRef.current) setSearching(false);
    },
    [user.id]
  );

  function onQuery(value) {
    setQuery(value);
    setFindMessage(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value.trim()), 300);
  }

  const openSale = useCallback(
    async (saleId) => {
      setPicking(true);
      setFindMessage(null);
      try {
        const res = await window.api.returns.getReturnable({ saleId, requestingUserId: user.id });
        if (!res?.success) throw new Error(res?.reason || "This sale can't be opened.");
        if (!res.lines.some((l) => l.returnable > 0)) {
          setFindMessage('Everything on this sale has already been returned.');
          setStep(0);
        } else {
          setData(res);
          setQty({});
          setStep(1);
        }
      } catch (err) {
        setFindMessage(err?.message || "This sale can't be opened.");
        setStep(0);
      }
      setPicking(false);
    },
    [user.id]
  );

  useEffect(() => {
    if (startSaleId) openSale(startSaleId);
  }, [startSaleId, openSale]);

  // ---- derived figures (preview only; the server recomputes everything) ----
  const lines = data?.lines || [];
  const total = data ? previewTotal(lines, qty, data.remainingValue) : 0;
  const anyQty = lines.some((l) => (Number(qty[l.sale_item_id]) || 0) > 0);
  const customer = data?.customer || null;
  const cap = customer ? cashCap(total, customer.balance) : total;
  const effectiveMode = customer ? (cap > 0 ? refundMode : 'account') : 'cash';
  const cash = !customer ? total : effectiveMode === 'cash' ? round2(Number(cashInput) || 0) : 0;
  const cashInvalid = !!customer && effectiveMode === 'cash' && cash > cap + 0.004;

  const onQty = useCallback((line, raw) => {
    setQty((prev) => ({ ...prev, [line.sale_item_id]: cleanQty(raw, line.returnable) }));
  }, []);

  function returnAll() {
    const next = {};
    for (const l of lines) if (l.returnable > 0) next[l.sale_item_id] = String(l.returnable);
    setQty(next);
  }

  function goToRefund() {
    setSubmitError(null);
    setCashInput(String(cap));
    setRefundMode(cap > 0 ? 'cash' : 'account');
    setStep(2);
  }

  function back() {
    setSubmitError(null);
    if (step === 2) setStep(1);
    else if (startSaleId) onExit();
    else setStep(0);
  }

  async function submit() {
    if (submitting || cashInvalid || !anyQty || !reason) return;
    const count = lines.reduce((s, l) => s + (Number(qty[l.sale_item_id]) || 0), 0);
    const credit = round2(total - cash);
    const money = [
      cash > 0 && `${formatCurrencyExact(cash)} goes back to the customer in cash`,
      credit > 0 && `${formatCurrencyExact(credit)} is taken off their account`,
    ].filter(Boolean);
    const message = [
      `${formatQty(count)} ${count === 1 ? 'item' : 'items'} ${restock ? 'will go back into stock' : "won't go back into stock"}.`,
      money.length ? `${money.join(' and ')}.` : null,
      "Returns can't be edited or deleted afterwards.",
    ]
      .filter(Boolean)
      .join(' ');

    const ok = await confirm({ title: 'Record this return?', message, confirmLabel: 'Record return', cancelLabel: 'Go back' });
    if (!ok) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await window.api.returns.create({
        requestingUserId: user.id,
        saleId: data.sale.id,
        lines: lines.filter((l) => (Number(qty[l.sale_item_id]) || 0) > 0).map((l) => ({ saleItemId: l.sale_item_id, quantity: Number(qty[l.sale_item_id]) })),
        reason,
        note: note.trim() || undefined,
        restock,
        cashRefund: cash,
      });
      if (!res?.success) throw new Error(res?.reason || 'The return could not be recorded.');
      setDone(res);
      toast.success(`Return ${res.return_no} recorded`);
    } catch (err) {
      const msg = err?.message || 'The return could not be recorded.';
      setSubmitError(msg);
      toast.error(msg);
    }
    setSubmitting(false);
  }

  if (done) {
    return <ReturnSuccess result={done} named={!!customer} onDone={onExit} onSeeSale={() => onOpenSale(data.sale.id)} />;
  }

  let body;
  if (step === 0) {
    body = (
      <>
        <FindSaleStep
          query={query}
          onQuery={onQuery}
          results={results}
          loading={searching}
          error={searchError}
          onRetry={() => runSearch(query.trim())}
          highlight={highlight}
          onHighlight={setHighlight}
          onPick={(s) => openSale(s.id)}
          picking={picking}
          message={findMessage}
        />
        <div style={{ marginTop: theme.spacing.md }}>
          <Button variant="plain" onClick={onExit}>
            Cancel
          </Button>
        </div>
      </>
    );
  } else if (!data) {
    body = <p style={styles.intro}>Opening sale…</p>;
  } else if (step === 1) {
    body = (
      <ItemsStep
        data={data}
        qty={qty}
        onQty={onQty}
        onReturnAll={returnAll}
        reason={reason}
        onReason={setReason}
        note={note}
        onNote={setNote}
        restock={restock}
        onRestock={setRestock}
        total={total}
      />
    );
  } else {
    body = (
      <RefundStep
        data={data}
        total={total}
        cap={cap}
        mode={effectiveMode}
        onMode={setRefundMode}
        cashInput={cashInput}
        onCashInput={(v) => setCashInput(cleanQty(v, Number.MAX_SAFE_INTEGER))}
        cash={cash}
        error={submitError}
      />
    );
  }

  const showBar = step > 0 && !!data;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', paddingBottom: showBar ? 0 : theme.spacing.xxl }}>
      <Stepper steps={STEPS} current={step} style={{ maxWidth: '560px', marginBottom: theme.spacing.lg }} />
      <div style={{ flex: 1, paddingBottom: showBar ? theme.spacing.lg : 0 }}>{body}</div>
      {showBar && (
        <StickyActions
          cancelLabel="Back"
          onCancel={back}
          saving={submitting}
          size={step === 2 ? 'lg' : undefined}
          saveLabel={step === 1 ? 'Continue' : 'Record return'}
          saveDisabled={step === 1 ? !anyQty || !reason : cashInvalid}
          onSave={step === 1 ? goToRefund : submit}
        />
      )}
    </div>
  );
}

const styles = {
  intro: { ...theme.type.subhead, color: c.labelSecondary, margin: `0 0 ${theme.spacing.md}` },
};
