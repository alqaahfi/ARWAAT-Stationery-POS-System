import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Button, Card, EmptyState, Modal, useConfirm, useToast } from '../ui';
import { formatCurrency } from '../../utils/format';
import SaleCompleteSheet from '../../pages/POS/parts/SaleCompleteSheet';
import PrintPreviewModal from '../receipt/PrintPreviewModal';
import { SALE_COMPLETED_EVENT } from '../../pages/POS/Sale';
import { whileSaving } from '../../utils/appEvents';
import BillOverlay from './BillOverlay';
import BillPartyCard from './BillPartyCard';
import BillItemSearch from './BillItemSearch';
import MultiTypeQtyPanel, { entriesFromValues } from './MultiTypeQtyPanel';
import BillLines from './BillLines';
import { belowCostMessage } from '../../utils/belowCost';
import BillSummary, { PartyTypeBadge } from './BillSummary';
import { buildLine, computeTotals, lineTotal, lineUnits, purchasePriceFields, resolveLetterheadId, round2, tradeUnitCost } from './billingUtils';

// One billing form for both Sale and Purchase, so the two screens look and
// behave the same: party → items (search / barcode, quantity, free units, pack
// size, price) → discount → payment → save. Only the party (customer vs.
// supplier), where the price comes from, and the print step differ.
//
//   kind        'sale' | 'purchase'
//   presetParty { id } to lock the bill to a customer/supplier (opened from their profile)
//   onSaved     called right after the bill is saved, so the page behind can refresh
//   onClose     called when the overlay should go away
const TRADE_FIELDS = ['tradePrice', 'purchaseDiscount', 'extraDiscount'];

export default function QuickBillForm({ kind, presetParty = null, onSaved, onClose }) {
  const isPurchase = kind === 'purchase';
  const { user, hasPermission, getPermissionValue } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user.role === 'admin';
  const allowed = isPurchase ? isAdmin : hasPermission('make_sale');

  // ---------------- bill state ----------------
  const [party, setParty] = useState(null);
  const [partyLoading, setPartyLoading] = useState(!!presetParty);
  const [previousBalance, setPreviousBalance] = useState(null);
  const [lines, setLines] = useState([]);
  const [discountMode, setDiscountMode] = useState('percentage');
  const [discountInput, setDiscountInput] = useState('');
  const [paidInput, setPaidInput] = useState('');
  const [method, setMethod] = useState('cash');
  const [printFormat, setPrintFormat] = useState('retail-thermal');
  const [formatTouched, setFormatTouched] = useState(false);
  const [showDues, setShowDues] = useState(false);
  const [duesTouched, setDuesTouched] = useState(false);
  const [discountCap, setDiscountCap] = useState(null);
  const [discountError, setDiscountError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  // A saved purchase opens its A4 receipt preview before the overlay closes.
  const [purchasePreviewId, setPurchasePreviewId] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [focusKey, setFocusKey] = useState(null);
  // Product with several Types picked: { detail, unit, price, types } while its quantities are being typed.
  const [multi, setMulti] = useState(null);
  const [multiValues, setMultiValues] = useState({});
  const [multiError, setMultiError] = useState('');

  const linesRef = useRef(lines);
  linesRef.current = lines;
  const partyRef = useRef(party);
  partyRef.current = party;
  const savingRef = useRef(false);

  // ---------------- loading the party ----------------
  const loadParty = useCallback(
    async (id) => {
      const api = isPurchase ? window.api.suppliers : window.api.customers;
      const [full, ledger] = await Promise.all([api.getById({ id }), api.getLedger({ id })]);
      return { full, balance: ledger?.success ? ledger.balance : 0 };
    },
    [isPurchase]
  );

  async function repriceFor(customerId) {
    const current = linesRef.current;
    if (!current.length) return;
    const updated = await Promise.all(
      current.map(async (l) => ({ key: l.key, price: (await window.api.sales.resolvePrice({ productUnitId: l.unitId, customerId })).price }))
    );
    setLines((prev) => prev.map((l) => ({ ...l, unitPrice: updated.find((u) => u.key === l.key)?.price ?? l.unitPrice })));
  }

  async function choosePartyById(id) {
    const { full, balance } = await loadParty(id);
    if (!full) {
      toast.error(isPurchase ? "That supplier couldn't be opened." : "That customer couldn't be opened.");
      return;
    }
    setParty(full);
    setPreviousBalance(balance);
    if (!isPurchase) await repriceFor(full.id);
  }

  async function clearParty() {
    setParty(null);
    setPreviousBalance(null);
    if (!isPurchase) await repriceFor(null);
  }

  useEffect(() => {
    if (!presetParty?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { full, balance } = await loadParty(presetParty.id);
        if (cancelled) return;
        if (full) {
          setParty(full);
          setPreviousBalance(balance);
        } else {
          toast.error("That account couldn't be opened.");
        }
      } catch {
        if (!cancelled) toast.error("That account couldn't be opened.");
      }
      if (!cancelled) setPartyLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetParty?.id]);

  useEffect(() => {
    if (isPurchase) return;
    window.api.sales.getCashierDiscountCap({ userId: user.id }).then((res) => setDiscountCap(res?.capPercentage ?? null)).catch(() => {});
  }, [isPurchase, user.id]);

  // Wholesale customers default to the A4 invoice, everyone else to the small receipt.
  useEffect(() => {
    if (isPurchase || formatTouched) return;
    setPrintFormat(party?.customer_type === 'wholesale' ? 'wholesale-a4' : 'retail-thermal');
  }, [isPurchase, party, formatTouched]);

  // ---------------- items ----------------
  // A scanned barcode (opts.scanned) is one specific Type: it adds 1 of the default pack size
  // straight away and never opens the several-Types panel (rule 4).
  async function addItem(variantId, opts = {}) {
    setError('');
    let detail;
    try {
      detail = await window.api.sales.getVariantForCart({ variantId });
    } catch {
      detail = null;
    }
    if (!detail || !detail.defaultUnitId) {
      toast.error('This item has no selling unit configured.');
      return;
    }
    const unit = detail.units.find((u) => u.id === detail.defaultUnitId);
    const price = isPurchase
      ? unit.costPrice
      : (await window.api.sales.resolvePrice({ productUnitId: unit.id, customerId: partyRef.current?.id || null })).price;

    // A product with several Types: ask for every Type's quantity at once.
    const types = (await window.api.sales.getProductTypes({ productId: detail.product.id }).catch(() => [])) || [];
    if (types.length > 1 && !opts.scanned) {
      setMultiValues({});
      setMultiError('');
      setMulti({ detail, unit, price, types });
      return;
    }
    setFocusKey(addLineFor(detail, unit, price, 1));
  }

  // Adds `quantity` of one Type; an existing line for the same Type + pack size just grows.
  function addLineFor(detail, unit, price, quantity) {
    const existing = linesRef.current.find((l) => l.variantId === detail.variant.id && l.unitId === unit.id);
    if (existing) {
      setLines((prev) => prev.map((l) => (l.key === existing.key ? { ...l, quantity: round2((Number(l.quantity) || 0) + quantity) } : l)));
      return existing.key;
    }
    const line = { ...buildLine(detail, unit, price, isPurchase ? purchasePriceFields(unit) : {}), quantity };
    // Lines added in one go are appended to linesRef right away so a repeat Type merges instead of duplicating.
    linesRef.current = [...linesRef.current, line];
    setLines((prev) => [...prev, line]);
    return line.key;
  }

  function confirmMulti() {
    if (!multi) return;
    const entries = entriesFromValues(multi.types, multiValues);
    if (entries.length === 0) {
      setMultiError('Type a quantity for at least one Type.');
      return;
    }
    let lastKey = null;
    for (const { type, quantity } of entries) {
      const detail = { ...multi.detail, variant: { ...multi.detail.variant, id: type.variantId, variantName: type.variantName, stockQty: type.stockQty } };
      lastKey = addLineFor(detail, multi.unit, multi.price, quantity);
    }
    setMulti(null);
    setFocusKey(lastKey);
  }

  // After an item is added, jump to its quantity box so a number can be typed straight away.
  useEffect(() => {
    if (!focusKey) return;
    const el = document.getElementById(`bill-qty-${focusKey}`);
    el?.scrollIntoView({ block: 'nearest' });
    el?.focus();
    el?.select?.();
    setFocusKey(null);
  }, [focusKey, lines]);

  const updateField = useCallback((key, field, value) => {
    setError('');
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, [field]: value };
        // Trade Price lines: the unit cost follows the three trade inputs.
        if (l.pricingMethod === 'trade' && TRADE_FIELDS.includes(field)) next.unitPrice = tradeUnitCost(next);
        return next;
      })
    );
  }, []);

  const updateUnit = useCallback(
    async (key, unitId) => {
      const line = linesRef.current.find((l) => l.key === key);
      const unit = line?.units.find((u) => u.id === unitId);
      if (!unit) return;
      const price = isPurchase
        ? unit.costPrice
        : (await window.api.sales.resolvePrice({ productUnitId: unitId, customerId: partyRef.current?.id || null })).price;
      const priceFields = isPurchase ? purchasePriceFields(unit) : { unitPrice: price };
      setLines((prev) =>
        prev.map((l) => {
          if (l.key !== key) return l;
          const next = { ...l, unitId, conversionFactor: unit.conversionFactor, costPrice: unit.costPrice, ...priceFields };
          // Leaving Trade Price behind: drop its inputs so nothing stale is shown.
          if (isPurchase && priceFields.pricingMethod === 'simple') Object.assign(next, { tradePrice: undefined, purchaseDiscount: undefined, extraDiscount: undefined });
          return next;
        })
      );
    },
    [isPurchase]
  );

  const removeLine = useCallback((key) => setLines((prev) => prev.filter((l) => l.key !== key)), []);

  // ---------------- derived values ----------------
  const totals = useMemo(() => computeTotals({ lines, discountMode, discountInput, paidInput }), [lines, discountMode, discountInput, paidInput]);

  // Sold + free units of one item, across all its lines, against what is on the shelf.
  const stockIssues = useMemo(() => {
    if (isPurchase) return {};
    const perVariant = {};
    for (const l of lines) perVariant[l.variantId] = (perVariant[l.variantId] || 0) + lineUnits(l) * l.conversionFactor;
    const issues = {};
    for (const l of lines) if (!l.allowNegative && perVariant[l.variantId] > l.stockQty) issues[l.key] = true;
    return issues;
  }, [isPurchase, lines]);

  const effectiveCap = isPurchase ? null : getPermissionValue('max_discount_percentage') ?? discountCap;
  const discountExceedsCap = effectiveCap !== null && effectiveCap !== undefined && totals.discountPercent > Number(effectiveCap) + 0.0001;

  // Their account before this bill, and after it. Nothing counts as paid until a payment is typed.
  const newBalance = previousBalance !== null ? round2(previousBalance + totals.total - totals.paid) : null;

  // Show the balance on the receipt by default whenever the customer will still owe something.
  useEffect(() => {
    if (isPurchase || !party || duesTouched) return;
    setShowDues((previousBalance || 0) + totals.balanceDue !== 0);
  }, [isPurchase, party, previousBalance, totals.balanceDue, duesTouched]);

  // ---------------- saving ----------------
  function validate() {
    if (isPurchase && !party) return 'Choose a supplier first.';
    if (lines.length === 0) return 'Add at least one item.';
    for (const l of lines) {
      if (!(Number(l.quantity) > 0)) return `Enter a quantity for ${l.productName}.`;
      if (Number(l.focQuantity) < 0 || Number.isNaN(Number(l.focQuantity))) return `Free quantity for ${l.productName} isn't valid.`;
      if (isPurchase && (l.unitPrice === '' || Number(l.unitPrice) < 0 || Number.isNaN(Number(l.unitPrice)))) return `Enter a buying price for ${l.productName}.`;
      if (!isPurchase && (l.unitPrice === '' || Number(l.unitPrice) < 0 || Number.isNaN(Number(l.unitPrice)))) return `Enter a selling price for ${l.productName}.`;
    }
    if (Object.keys(stockIssues).length) return 'Some items are over what you have in stock. Lower the quantity or the free units.';
    if (!isPurchase && !party && totals.balanceDue > 0) return 'Choose a customer to leave a balance, or take the full payment.';
    return null;
  }

  async function handleSave() {
    if (savingRef.current || done) return;
    setError('');
    setDiscountError('');
    if (discountExceedsCap) {
      setDiscountError(`Discount exceeds your limit of ${effectiveCap}%.`);
      return;
    }
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    savingRef.current = true;
    try {
      if (isPurchase) await savePurchase();
      else await saveSale();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function savePurchase() {
    const ok = await confirm({
      title: 'Save this purchase?',
      message: `This adds stock for ${lines.length} item${lines.length === 1 ? '' : 's'} and adds ${formatCurrency(totals.total)} to your account with ${party.name}. Purchases can't be edited or deleted afterwards.`,
      confirmLabel: 'Save purchase',
      cancelLabel: 'Go back',
    });
    if (!ok) return;

    setSaving(true);
    let res;
    try {
      res = await whileSaving(() => window.api.purchases.create({
        supplierId: party.id,
        items: lines.map((l) => ({
          productVariantId: l.variantId,
          productUnitId: l.unitId,
          quantity: Number(l.quantity),
          focQuantity: Number(l.focQuantity) || 0,
          unitCost: Number(l.unitPrice),
        })),
        discountAmount: totals.discountAmount,
        paidAmount: totals.paid,
        paymentMethod: method,
        createdBy: user.id,
      }));
    } catch {
      res = { success: false };
    }
    if (!res.success) {
      setError(res.reason || 'Could not complete purchase.');
      toast.error(res.reason || 'Could not complete purchase.');
      return;
    }
    toast.success('Purchase saved');
    onSaved?.(res);
    if (res.purchaseId) setPurchasePreviewId(res.purchaseId);
    else onClose?.();
  }

  async function saveSale() {
    setSaving(true);
    // A cashier's discount limit can change mid-shift — check it again right before saving.
    try {
      const capRes = await window.api.sales.getCashierDiscountCap({ userId: user.id });
      const fresh = capRes?.capPercentage;
      if (fresh !== null && fresh !== undefined && totals.discountPercent > Number(fresh) + 0.0001) {
        setDiscountCap(fresh);
        setDiscountError(`Discount exceeds your limit of ${fresh}%.`);
        return;
      }
    } catch {
      // Falls back to the limit already loaded.
    }

    // Rule 6: the Admin's price override below the buying price is allowed after a warning.
    if (isAdmin) {
      const low = lines
        .filter((l) => Number(l.costPrice) > 0 && Number(l.unitPrice) < Number(l.costPrice) - 0.005)
        .map((l) => ({ unitName: l.productName, level: 'Price', price: Number(l.unitPrice), cost: Number(l.costPrice) }));
      if (low.length) {
        const ok = await confirm({ title: 'Price below buying price', message: belowCostMessage(low), confirmLabel: 'Sell anyway', cancelLabel: 'Go back' });
        if (!ok) return;
      }
    }

    // Rule 2: going over a customer's credit limit is a warning only — they can save anyway.
    if (party && totals.balanceDue > 0) {
      const credit = await window.api.customers.creditCheck({ customerId: party.id, addAmount: totals.balanceDue }).catch(() => null);
      if (credit?.overLimit) {
        const ok = await confirm({ title: 'Over the credit limit', message: credit.message, confirmLabel: 'Save anyway', cancelLabel: 'Go back' });
        if (!ok) return;
      }
    }

    const letterheads = await window.api.letterheads.list().catch(() => []);
    const payload = {
      saleType: party ? party.customer_type : 'retail',
      customerId: party?.id || null,
      cashierId: user.id,
      letterheadId: resolveLetterheadId(letterheads || [], party),
      items: lines.map((l) => ({
        productVariantId: l.variantId,
        productUnitId: l.unitId,
        quantity: Number(l.quantity) || 0,
        focQuantity: Number(l.focQuantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discountAmount: 0,
        lineTotal: lineTotal(l),
      })),
      discountAmount: totals.discountAmount,
      paidAmount: totals.paid,
      paymentMethod: method,
    };

    const res = await whileSaving(() => window.api.sales.create(payload));
    if (!res.success) {
      // The server re-checks every price; take any price that changed while the bill was open.
      if (res.priceChanged && Array.isArray(res.changedLines)) {
        setLines((prev) =>
          prev.map((l) => {
            const hit = res.changedLines.find((c) => c.productVariantId === l.variantId && c.productUnitId === l.unitId);
            return hit ? { ...l, unitPrice: hit.price } : l;
          })
        );
      }
      setError(res.reason || 'Could not complete sale.');
      return; // the bill stays as it is, so it can be fixed and retried
    }
    window.dispatchEvent(new CustomEvent(SALE_COMPLETED_EVENT));
    onSaved?.(res);

    const effectiveShowDues = showDues && !!party;
    // Nothing goes to the printer automatically: the print preview opens
    // first and its Print button does the physical print. The sale is already
    // saved, so closing the preview never affects it.
    setDone({
      invoiceNo: res.invoiceNo,
      saleId: res.saleId,
      totalAmount: totals.total,
      changeDue: totals.changeDue,
      balanceDue: totals.balanceDue,
      printType: printFormat,
      showDues: effectiveShowDues,
      printSuccess: null,
      printReason: null,
      pdfPath: null,
    });
    setShowPreview(true);
  }

  function onPrinted(res) {
    setDone((d) => ({ ...d, printSuccess: true, printReason: null, pdfPath: res.pdfPath || d.pdfPath }));
  }

  // Thermal receipts are previewed from the same data the printer uses; an A4 invoice embeds its merged PDF.
  useEffect(() => {
    if (!done || done.printType === 'wholesale-a4') {
      setReceiptPreview(null);
      return undefined;
    }
    let cancelled = false;
    Promise.all([window.api.sales.getReceiptData({ saleId: done.saleId, showDues: done.showDues }), window.api.settings.getAll()])
      .then(([data, settings]) => {
        if (!cancelled) setReceiptPreview({ data, settings });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [done?.saleId, done?.showDues, done?.printType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------- closing / keys ----------------
  async function requestClose() {
    if (saving) return;
    if (done) {
      onClose?.();
      return;
    }
    if (lines.length > 0) {
      const ok = await confirm({
        title: isPurchase ? 'Discard this purchase?' : 'Discard this sale?',
        message: 'The items you added will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        destructive: true,
      });
      if (!ok) return;
    }
    onClose?.();
  }

  const handlerRef = useRef(null);
  handlerRef.current = (e) => {
    if (showPreview || purchasePreviewId) return; // the print preview window owns the keyboard
    if (done) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      } else if ((e.key === 'r' || e.key === 'R') && !done.printSuccess) {
        e.preventDefault();
        setShowPreview(true);
      }
      return;
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    }
  };
  useEffect(() => {
    const onKey = (e) => handlerRef.current(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ---------------- render ----------------
  const title = isPurchase ? 'New Purchase' : 'New Sale';

  if (!allowed) {
    return (
      <BillOverlay title={title} onRequestClose={onClose}>
        <Card>
          <EmptyState
            icon={Lock}
            title={isPurchase ? 'Only the owner can record purchases' : "You don't have access to this"}
            message={isPurchase ? 'Ask the shop owner to sign in to add stock you bought.' : 'Ask your admin to grant you the "make sale" permission.'}
          />
        </Card>
      </BillOverlay>
    );
  }

  const partyName = party ? party.name : isPurchase ? 'Not chosen yet' : 'Walk-in Customer';

  return (
    <BillOverlay
      title={title}
      subtitle={presetParty && party ? `For ${party.name}` : undefined}
      onRequestClose={requestClose}
    >
      <div style={styles.layout}>
        <div style={styles.left}>
          <BillPartyCard
            kind={kind}
            party={party}
            loading={partyLoading}
            locked={!!presetParty}
            onPick={(row) => choosePartyById(row.id)}
            onClear={clearParty}
          />
          <Card padding={theme.spacing.smd} style={{ overflow: 'visible' }}>
            <BillItemSearch onPick={addItem} disabled={saving || (isPurchase && !party)} autoFocus={!!presetParty || !isPurchase} />
            {isPurchase && !party && (
              <div style={{ ...theme.type.footnote, color: theme.colors.labelSecondary, marginTop: theme.spacing.xs }}>Choose a supplier above to start adding items.</div>
            )}
          </Card>
          <BillLines
            lines={lines}
            kind={kind}
            canSeeCost={isAdmin}
            canEditPrice={isAdmin}
            stockIssues={stockIssues}
            onUnit={updateUnit}
            onField={updateField}
            onRemove={removeLine}
          />
        </div>
        <BillSummary
          kind={kind}
          partyName={partyName}
          partyBadge={!isPurchase ? <PartyTypeBadge type={party ? party.customer_type : 'retail'} /> : null}
          totals={totals}
          previousBalance={party ? previousBalance : null}
          newBalance={newBalance}
          discountMode={discountMode}
          onDiscountMode={(m) => {
            setDiscountMode(m);
            setDiscountError('');
          }}
          discountInput={discountInput}
          onDiscountInput={(v) => {
            setDiscountInput(v);
            setDiscountError('');
          }}
          discountCap={effectiveCap}
          discountError={discountError || (discountExceedsCap ? `Discount exceeds your limit of ${effectiveCap}%.` : '')}
          paidInput={paidInput}
          onPaidInput={(v) => {
            setPaidInput(v);
            setError('');
          }}
          method={method}
          onMethod={setMethod}
          printFormat={printFormat}
          onPrintFormat={(f) => {
            setFormatTouched(true);
            setPrintFormat(f);
          }}
          showDuesOption={!!party}
          showDues={showDues}
          onShowDues={(v) => {
            setDuesTouched(true);
            setShowDues(v);
          }}
          itemCount={lines.length}
          error={error}
          saving={saving}
          canSave={lines.length > 0 && !partyLoading && (!isPurchase || !!party)}
          onSave={handleSave}
        />
      </div>

      {done && (
        <SaleCompleteSheet
          data={done}
          receiptPreview={receiptPreview}
          onRetry={() => setShowPreview(true)}
          onClose={() => onClose?.()}
          closeLabel="Done"
        />
      )}
      {purchasePreviewId && (
        <PrintPreviewModal
          purchaseId={purchasePreviewId}
          onClose={() => {
            setPurchasePreviewId(null);
            onClose?.();
          }}
        />
      )}
      {done && showPreview && (
        <PrintPreviewModal
          saleId={done.saleId}
          printType={done.printType}
          showDues={done.showDues}
          onPrinted={onPrinted}
          onClose={() => setShowPreview(false)}
        />
      )}
      <Modal
        open={!!multi}
        onClose={() => setMulti(null)}
        title="How many of each?"
        width={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMulti(null)}>
              Cancel
            </Button>
            <Button onClick={confirmMulti}>Add to {isPurchase ? 'purchase' : 'sale'}</Button>
          </>
        }
      >
        {multi && (
          <MultiTypeQtyPanel
            productName={multi.detail.product.name}
            unitLabel={multi.unit.unitName}
            types={multi.types}
            values={multiValues}
            onChange={(id, v) => {
              setMultiError('');
              setMultiValues((prev) => ({ ...prev, [id]: v }));
            }}
            onConfirm={confirmMulti}
            onCancel={() => setMulti(null)}
            stockOf={isPurchase ? undefined : (t) => t.stockQty / multi.unit.conversionFactor}
            error={multiError}
          />
        )}
      </Modal>
    </BillOverlay>
  );
}

const styles = {
  layout: { flex: 1, minHeight: 0, display: 'flex', gap: theme.spacing.md },
  left: { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: theme.spacing.smd },
};
