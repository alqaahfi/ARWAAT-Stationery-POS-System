import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { formatCurrency, formatCount } from '../../utils/format';
import ThermalContent from '../../components/receipt/ThermalContent';

// Local filesystem paths need the file:// scheme (and a third slash on
// Windows) to load as a src — same helper used across the Print pages.
function toFileUrl(p) {
  if (!p) return null;
  const normalized = p.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

// Cashier Mode is 100% keyboard-operable — see the build prompt for the full
// stage-by-stage spec. Built as one component on purpose: a keyboard state
// machine needs one source of truth for "what stage are we in and what does
// Tab/Enter/Esc do right now", which the earlier independent sub-components
// (CustomerSelector/ProductSearch/Cart/PaymentPanel, each with their own
// keydown listener) couldn't coordinate cleanly. Mouse use still works
// everywhere as a fallback — this is keyboard-first, not keyboard-only.

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function draftKey(stationCode) {
  return `pos_sale_draft_${stationCode || 'MAIN'}`;
}

// Fired on `window` right after a sale is committed — the top utility bar's
// Today's Revenue tile listens for this so it updates immediately rather
// than waiting for its periodic poll.
export const SALE_COMPLETED_EVENT = 'pos:sale-completed';

// Falls back to the letterhead explicitly marked default; if none is marked
// but exactly one letterhead exists, that's an unambiguous choice too — no
// reason to require the admin remember to flip a "default" switch when
// there's nothing else it could mean.
function resolveDefaultLetterheadId(letterheads) {
  const explicit = letterheads.find((l) => l.is_default);
  if (explicit) return explicit.id;
  return letterheads.length === 1 ? letterheads[0].id : null;
}

// Exported so the top utility bar's "?" shortcuts popup can list every
// stage's key bindings straight from here — the one place this flow's
// keyboard behavior is actually defined — instead of a hardcoded duplicate.
export const STAGE_LABELS = {
  idle: 'Idle',
  customer: 'Customer',
  'item-search': 'Add Items',
  qty: 'Quantity',
  'cart-edit': 'Edit Cart',
  discount: 'Discount',
  format: 'Receipt Format',
  payment: 'Payment',
  confirm: 'Done',
};

// Pure — used by both this screen's own legend bar (via getLegend() below,
// passing the live state) and the top utility bar's shortcuts popup (passing
// no context, which falls back to each stage's baseline text — exactly what
// a static reference should show). Keeping this as one function is what
// keeps the two from ever listing different key bindings.
export function getStageLegend(stage, ctx = {}) {
  const { draftAvailable, searchResultsOpen, editingLine, partialBlockedNoCustomer, confirmData } = ctx;
  switch (stage) {
    case 'idle':
      return draftAvailable ? 'R Resume Draft · N Start New' : 'S Start New Sale';
    case 'customer':
      return '↑↓ Select · Enter Choose Customer · Tab Walk-in / Continue · Esc Cancel Sale';
    case 'item-search':
      return searchResultsOpen
        ? '↑↓ Product · Tab Type/Unit · ←→ Cycle · Enter Confirm · Esc Cancel Sale'
        : '↑ Edit Cart · Tab Continue to Discount · Esc Cancel Sale';
    case 'qty':
      return 'Enter Add to Cart · Esc Cancel Item';
    case 'cart-edit':
      return editingLine
        ? 'Enter Confirm Qty · Esc Cancel Edit'
        : '↑↓ Select Line · Enter Edit Qty · Del Remove · Ctrl+Z Undo · Esc Back to Search';
    case 'discount':
      return 'Tab / Enter Continue · Esc Cancel Sale';
    case 'format':
      return '←→ or 1/2 Toggle Format · Tab / Enter Continue · Esc Cancel Sale';
    case 'payment':
      return partialBlockedNoCustomer ? 'C/B/O Payment Method · Esc Select a Customer' : 'Enter Exact Payment · C/B/O Method · Esc Cancel Sale';
    case 'confirm':
      return confirmData && !confirmData.printSuccess ? 'Enter / Esc Close · R Retry Print' : 'Enter / Esc Close';
    default:
      return '';
  }
}

// Module-scope so AdminDashboard/Dashboard's navigate() can ask "is a sale in
// progress?" before switching away from this screen — this app's router has
// no per-route leave-guard hook, so this is a minimal, explicit substitute
// (same pattern ProductList.jsx uses to remember state across unmounts).
let leaveGuardState = { hasCartItems: false };
export function isPosSaleInProgress() {
  return leaveGuardState.hasCartItems;
}

export default function Sale() {
  const { user, hasPermission, getPermissionValue } = useAuth();
  const isAdmin = user.role === 'admin';
  const canSell = hasPermission('make_sale');

  // ---------------- stage machine ----------------
  const [stage, setStage] = useState('idle');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [stationCode, setStationCode] = useState('MAIN');

  // ---------------- sale data ----------------
  const [customer, setCustomer] = useState(null);
  const [letterheadId, setLetterheadId] = useState(null);
  const [cartLines, setCartLines] = useState([]);
  const [discountMode, setDiscountMode] = useState('percentage');
  const [discountInput, setDiscountInput] = useState(0);
  const [amountTendered, setAmountTendered] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [printFormat, setPrintFormat] = useState('retail-thermal'); // 'wholesale-a4' | 'retail-thermal'
  const [discountCap, setDiscountCap] = useState(null);

  // ---------------- show outstanding balance toggle ----------------
  // customerBalanceBeforeSale is a snapshot taken the moment a customer is
  // selected (their ledger balance before this sale is added to it) — the
  // smart default below needs it. showDuesTouched tracks whether the cashier
  // has manually overridden the smart default during this payment-stage
  // visit, so the auto-recompute (as amountTendered changes) doesn't fight
  // a deliberate choice.
  const [customerBalanceBeforeSale, setCustomerBalanceBeforeSale] = useState(null);
  const [showDues, setShowDues] = useState(false);
  const [showDuesTouched, setShowDuesTouched] = useState(false);

  // ---------------- stage 1: customer ----------------
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerHighlight, setCustomerHighlight] = useState(0);
  const [customerNote, setCustomerNote] = useState('');

  // ---------------- stage 2: item-search ----------------
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchHighlight, setSearchHighlight] = useState(0);
  const [searchNavigated, setSearchNavigated] = useState(false);
  const [activeSelector, setActiveSelector] = useState('unit'); // 'type' | 'unit'
  const [typeIndex, setTypeIndex] = useState(0);
  const [unitIndex, setUnitIndex] = useState(0);
  const [itemSearchMessage, setItemSearchMessage] = useState('');

  // ---------------- stage 3: qty ----------------
  const [pendingItem, setPendingItem] = useState(null);
  const [qtyValue, setQtyValue] = useState('1');

  // ---------------- stage 4: cart-edit ----------------
  const [cartHighlight, setCartHighlight] = useState(0);
  const [editingLineIndex, setEditingLineIndex] = useState(null);
  const [editingQtyValue, setEditingQtyValue] = useState('');
  const [recentlyRemoved, setRecentlyRemoved] = useState(null);

  // ---------------- errors ----------------
  const [discountError, setDiscountError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [finalizeError, setFinalizeError] = useState('');

  // ---------------- finalize ----------------
  const [completing, setCompleting] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [retryingPrint, setRetryingPrint] = useState(false);
  // The on-screen receipt/invoice preview shown alongside the confirmation —
  // always fetched and shown regardless of whether the physical print
  // succeeded, via the same buildReceiptData() shape the print paths use.
  const [receiptPreview, setReceiptPreview] = useState(null);

  // ---------------- refs ----------------
  const customerInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const editQtyInputRef = useRef(null);
  const discountInputRef = useRef(null);
  const removedTimeoutRef = useRef(null);
  const handlerRef = useRef(() => {});

  // ---------------- mount: discount cap + station code ----------------
  useEffect(() => {
    window.api.sales.getCashierDiscountCap({ userId: user.id }).then((res) => setDiscountCap(res.capPercentage));
    window.api.license.getStatus().then((res) => setStationCode(res.stationCode || 'MAIN'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    setDraftAvailable(!!localStorage.getItem(draftKey(stationCode)));
  }, [stationCode]);

  // Re-resolve every line's price whenever the customer changes (net-rate /
  // percentage rules key off the customer, retail vs wholesale too).
  useEffect(() => {
    if (cartLines.length === 0) return;
    (async () => {
      const updated = await Promise.all(
        cartLines.map(async (line) => {
          const res = await window.api.sales.resolvePrice({ productUnitId: line.unitId, customerId: customer?.id || null });
          return { ...line, unitPrice: res.price };
        })
      );
      setCartLines(updated);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  // Leave-guard: let the router ask whether a sale is genuinely in progress.
  useEffect(() => {
    leaveGuardState = { hasCartItems: cartLines.length > 0 };
    return () => {
      leaveGuardState = { hasCartItems: false };
    };
  }, [cartLines.length]);

  // Draft autosave — only once there's something worth saving.
  useEffect(() => {
    if (stage === 'idle' || stage === 'confirm') return;
    if (cartLines.length === 0 && !customer) return;
    const t = setTimeout(() => {
      const draft = {
        customerId: customer?.id || null,
        lines: cartLines.map((l) => ({ variantId: l.variantId, unitId: l.unitId, quantity: l.quantity })),
        discountMode,
        discountInput,
      };
      try {
        localStorage.setItem(draftKey(stationCode), JSON.stringify(draft));
        setDraftAvailable(true);
      } catch {
        // localStorage unavailable — draft just won't persist.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [customer, cartLines, discountMode, discountInput, stage, stationCode]);

  // Customer search (debounced).
  useEffect(() => {
    const t = setTimeout(() => {
      if (!customerQuery.trim()) {
        setCustomerResults([]);
        return;
      }
      window.api.customers.searchMinimal({ search: customerQuery.trim() }).then((res) => {
        setCustomerResults(res);
        setCustomerHighlight(0);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [customerQuery]);

  // Item search (debounced, grouped by product).
  useEffect(() => {
    setSearchNavigated(false);
    const t = setTimeout(() => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      window.api.sales.searchProductsGrouped({ query: searchQuery.trim() }).then((res) => {
        setSearchResults(res);
        setSearchHighlight(0);
        setActiveSelector('unit');
        setTypeIndex(0);
        const first = res[0];
        setUnitIndex(first ? Math.max(0, first.units.findIndex((u) => u.isDefaultSaleUnit)) : 0);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Focus management per stage.
  useEffect(() => {
    if (stage === 'customer') customerInputRef.current?.focus();
    else if (stage === 'item-search') searchInputRef.current?.focus();
    else if (stage === 'qty') {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    } else if (stage === 'discount') discountInputRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    if (editingLineIndex !== null) {
      editQtyInputRef.current?.focus();
      editQtyInputRef.current?.select();
    }
  }, [editingLineIndex]);

  // A fresh visit to the payment stage starts the toggle back at "not
  // manually touched" so its smart default (below) applies again.
  useEffect(() => {
    if (stage !== 'payment') setShowDuesTouched(false);
  }, [stage]);

  // Only thermal needs this — an A4 sale's on-screen preview embeds the
  // already-merged PDF the print path wrote out (confirmData.pdfPath)
  // directly, no separate fetch needed. Fetches the same shared receipt-data
  // shape the thermal print path uses, so the on-screen preview always
  // matches what was (or would be) printed.
  useEffect(() => {
    if (stage !== 'confirm' || !confirmData || confirmData.printType === 'wholesale-a4') {
      setReceiptPreview(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      window.api.sales.getReceiptData({ saleId: confirmData.saleId, showDues: confirmData.showDues }),
      window.api.settings.getAll(),
    ]).then(([data, settings]) => {
      if (!cancelled) setReceiptPreview({ data, settings });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, confirmData?.saleId, confirmData?.showDues, confirmData?.printType]);

  // ---------------- derived values ----------------
  const saleType = customer ? customer.customer_type : 'retail';

  const stockIssues = {};
  for (const line of cartLines) {
    if ((Number(line.quantity) || 0) * line.conversionFactor > line.stockQty) stockIssues[line.key] = true;
  }
  const hasStockIssue = Object.keys(stockIssues).length > 0;

  const subtotal = cartLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const discountAmount =
    discountMode === 'percentage' ? round2((subtotal * (Number(discountInput) || 0)) / 100) : round2(Number(discountInput) || 0);
  const totalAmount = Math.max(0, round2(subtotal - discountAmount));

  const discountPercentageEquivalent =
    discountMode === 'percentage' ? Number(discountInput) || 0 : subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  const effectiveDiscountCap = getPermissionValue('max_discount_percentage') ?? discountCap;
  const discountExceedsCap = effectiveDiscountCap !== null && effectiveDiscountCap !== undefined && discountPercentageEquivalent > Number(effectiveDiscountCap);

  const tenderedNumber = amountTendered === '' ? totalAmount : Number(amountTendered) || 0;
  const paidAmount = Math.min(tenderedNumber, totalAmount);
  const changeDue = Math.max(0, round2(tenderedNumber - totalAmount));
  const balanceDue = Math.max(0, round2(totalAmount - paidAmount));
  const partialBlockedNoCustomer = balanceDue > 0 && !customer;

  // Smart default: pre-check "Show Outstanding Balance" once the predicted
  // post-sale balance (what the customer owed before + whatever of this sale
  // stays unpaid) is nonzero — recomputes as the tendered amount changes,
  // but only while the cashier hasn't manually overridden it this visit.
  useEffect(() => {
    if (stage !== 'payment' || !customer || showDuesTouched) return;
    const predicted = (customerBalanceBeforeSale || 0) + balanceDue;
    setShowDues(predicted !== 0);
  }, [stage, customer, balanceDue, customerBalanceBeforeSale, showDuesTouched]);

  const qtyNumber = Number(qtyValue) || 0;
  const qtyStockError =
    pendingItem && qtyNumber > 0 && qtyNumber * pendingItem.conversionFactor > pendingItem.stockQty
      ? `Only ${formatCount(pendingItem.stockQty / pendingItem.conversionFactor)} in stock.`
      : '';

  const editingLine = editingLineIndex !== null ? cartLines[editingLineIndex] : null;
  const editingQtyNumber = Number(editingQtyValue) || 0;
  const editingQtyStockError =
    editingLine && editingQtyNumber > 0 && editingQtyNumber * editingLine.conversionFactor > editingLine.stockQty
      ? `Only ${formatCount(editingLine.stockQty / editingLine.conversionFactor)} in stock.`
      : '';

  // ---------------- state resets ----------------

  function clearSaleState() {
    setCustomer(null);
    setLetterheadId(null);
    setCartLines([]);
    setDiscountMode('percentage');
    setDiscountInput(0);
    setAmountTendered('');
    setPaymentMethod('cash');
    setPrintFormat('retail-thermal');
    setCustomerBalanceBeforeSale(null);
    setShowDues(false);
    setShowDuesTouched(false);
    setCustomerQuery('');
    setCustomerResults([]);
    setCustomerHighlight(0);
    setCustomerNote('');
    setSearchQuery('');
    setSearchResults([]);
    setSearchHighlight(0);
    setPendingItem(null);
    setQtyValue('1');
    setCartHighlight(0);
    setEditingLineIndex(null);
    setEditingQtyValue('');
    setRecentlyRemoved(null);
    setDiscountError('');
    setPaymentError('');
    setFinalizeError('');
    setItemSearchMessage('');
  }

  function clearDraft() {
    localStorage.removeItem(draftKey(stationCode));
    setDraftAvailable(false);
  }

  // ---------------- stage 0: idle ----------------

  function startSale() {
    clearSaleState();
    setStage('customer');
  }

  async function resumeDraft() {
    const raw = localStorage.getItem(draftKey(stationCode));
    if (!raw) {
      startSale();
      return;
    }
    try {
      const draft = JSON.parse(raw);
      clearSaleState();

      let resumedCustomer = null;
      if (draft.customerId) {
        resumedCustomer = await window.api.customers.getById({ id: draft.customerId });
        const letterheads = await window.api.letterheads.list();
        setCustomer(resumedCustomer);
        setLetterheadId(resumedCustomer?.assigned_letterhead_id || resolveDefaultLetterheadId(letterheads) || null);
        const ledger = await window.api.customers.getLedger({ id: draft.customerId });
        setCustomerBalanceBeforeSale(ledger.success ? ledger.balance : 0);
      }

      const lines = [];
      for (const dl of draft.lines || []) {
        const detail = await window.api.sales.getVariantForCart({ variantId: dl.variantId });
        if (!detail) continue;
        const unit = detail.units.find((u) => u.id === dl.unitId) || detail.units.find((u) => u.id === detail.defaultUnitId);
        if (!unit) continue;
        const priceRes = await window.api.sales.resolvePrice({ productUnitId: unit.id, customerId: draft.customerId || null });
        lines.push({
          key: `${detail.variant.id}-${unit.id}-${Date.now()}-${Math.random()}`,
          variantId: detail.variant.id,
          variantName: detail.variant.variantName,
          productId: detail.product.id,
          productName: detail.product.name,
          baseUnitName: detail.product.baseUnitName,
          stockQty: detail.variant.stockQty,
          units: detail.units,
          unitId: unit.id,
          conversionFactor: unit.conversionFactor,
          quantity: dl.quantity,
          unitPrice: priceRes.price,
          costPrice: unit.costPrice,
        });
      }
      setCartLines(lines);
      setDiscountMode(draft.discountMode || 'percentage');
      setDiscountInput(draft.discountInput || 0);
      setStage(lines.length > 0 || resumedCustomer ? 'item-search' : 'customer');
    } catch {
      localStorage.removeItem(draftKey(stationCode));
      startSale();
    }
  }

  function discardDraftAndStart() {
    clearDraft();
    startSale();
  }

  // ---------------- stage 1: customer ----------------

  async function selectCustomerResult(c) {
    const full = await window.api.customers.getById({ id: c.id });
    const letterheads = await window.api.letterheads.list();
    setCustomer(full || c);
    setLetterheadId(full?.assigned_letterhead_id || resolveDefaultLetterheadId(letterheads) || null);
    setCustomerQuery('');
    setCustomerResults([]);
    setCustomerNote('');
    setStage('item-search');

    // Snapshot the customer's balance before this sale — the "Show
    // Outstanding Balance" toggle's smart default (payment stage) needs it.
    const ledger = await window.api.customers.getLedger({ id: c.id });
    setCustomerBalanceBeforeSale(ledger.success ? ledger.balance : 0);
  }

  // Walk-in has no assigned_letterhead_id of its own, but the shop's default
  // letterhead (if any) should still print on a walk-in wholesale-A4 sale —
  // this used to hardcode null here, which meant a default letterhead never
  // applied to any walk-in sale regardless of Settings.
  async function proceedFromCustomerAsWalkIn() {
    setCustomerNote(customerQuery.trim() ? 'No matching customer — continuing as Walk-in' : '');
    setCustomer(null);
    setCustomerBalanceBeforeSale(null);
    setCustomerQuery('');
    setCustomerResults([]);
    setStage('item-search');

    const letterheads = await window.api.letterheads.list();
    setLetterheadId(resolveDefaultLetterheadId(letterheads) || null);
  }

  // ---------------- stage 2: item-search ----------------

  function resetSelectorsForIndex(n) {
    const group = searchResults[n];
    if (!group) return;
    setActiveSelector('unit');
    setTypeIndex(0);
    setUnitIndex(Math.max(0, group.units.findIndex((u) => u.isDefaultSaleUnit)));
  }

  async function selectSearchResult(group, tIdx, uIdx) {
    const type = group.types[tIdx] || group.types[0];
    const unit = group.units[uIdx] || group.units[0];
    if (!type || !unit) return;
    const priceRes = await window.api.sales.resolvePrice({ productUnitId: unit.id, customerId: customer?.id || null });
    setPendingItem({
      variantId: type.variantId,
      variantName: type.variantName,
      productId: group.productId,
      productName: group.productName,
      baseUnitName: group.baseUnitName,
      stockQty: type.stockQty,
      units: group.units,
      unitId: unit.id,
      conversionFactor: unit.conversionFactor,
      unitPrice: priceRes.price,
      costPrice: unit.costPrice,
    });
    setQtyValue('1');
    setSearchQuery('');
    setSearchResults([]);
    setStage('qty');
  }

  async function handleItemSearchEnter() {
    const raw = searchQuery.trim();
    if (!raw) return;

    if (!searchNavigated) {
      const match = await window.api.sales.getVariantByBarcode({ barcode: raw });
      if (match) {
        const detail = await window.api.sales.getVariantForCart({ variantId: match.variantId });
        if (detail && detail.defaultUnitId) {
          const unit = detail.units.find((u) => u.id === detail.defaultUnitId);
          const priceRes = await window.api.sales.resolvePrice({ productUnitId: detail.defaultUnitId, customerId: customer?.id || null });
          setPendingItem({
            variantId: detail.variant.id,
            variantName: detail.variant.variantName,
            productId: detail.product.id,
            productName: detail.product.name,
            baseUnitName: detail.product.baseUnitName,
            stockQty: detail.variant.stockQty,
            units: detail.units,
            unitId: detail.defaultUnitId,
            conversionFactor: unit.conversionFactor,
            unitPrice: priceRes.price,
            costPrice: unit.costPrice,
          });
          setQtyValue('1');
          setSearchQuery('');
          setSearchResults([]);
          setStage('qty');
          return;
        }
      }
    }

    if (searchResults[searchHighlight]) {
      await selectSearchResult(searchResults[searchHighlight], typeIndex, unitIndex);
    }
  }

  // ---------------- stage 3: qty ----------------

  function addOrMergeCartLine(item) {
    setCartLines((lines) => {
      const idx = lines.findIndex((l) => l.variantId === item.variantId && l.unitId === item.unitId);
      if (idx >= 0) {
        return lines.map((l, i) => (i === idx ? { ...l, quantity: round2((Number(l.quantity) || 0) + item.quantity) } : l));
      }
      return [...lines, { key: `${item.variantId}-${item.unitId}-${Date.now()}`, ...item }];
    });
  }

  function confirmQty() {
    if (!pendingItem || qtyNumber <= 0 || qtyStockError) return;
    addOrMergeCartLine({ ...pendingItem, quantity: qtyNumber });
    setPendingItem(null);
    setQtyValue('1');
    setSearchQuery('');
    setSearchResults([]);
    setStage('item-search');
  }

  function cancelPendingItem() {
    setPendingItem(null);
    setQtyValue('1');
    setSearchQuery('');
    setSearchResults([]);
    setStage('item-search');
  }

  // ---------------- stage 4: cart-edit ----------------

  function enterCartEdit() {
    if (cartLines.length === 0) return;
    setCartHighlight((i) => Math.min(i, cartLines.length - 1));
    setStage('cart-edit');
  }

  function moveCartHighlight(delta) {
    setCartHighlight((i) => Math.max(0, Math.min(cartLines.length - 1, i + delta)));
  }

  function startEditCartLine() {
    const line = cartLines[cartHighlight];
    if (!line) return;
    setEditingLineIndex(cartHighlight);
    setEditingQtyValue(String(line.quantity));
  }

  function confirmEditCartLine() {
    if (editingLineIndex === null || editingQtyNumber <= 0 || editingQtyStockError) return;
    setCartLines((lines) => lines.map((l, i) => (i === editingLineIndex ? { ...l, quantity: editingQtyNumber } : l)));
    setEditingLineIndex(null);
    setEditingQtyValue('');
  }

  function cancelEditCartLine() {
    setEditingLineIndex(null);
    setEditingQtyValue('');
  }

  function removeCartLineAt(index) {
    const line = cartLines[index];
    if (!line) return;
    const remainingCount = cartLines.length - 1;
    setCartLines((lines) => lines.filter((_, i) => i !== index));
    setRecentlyRemoved({ line, index });
    clearTimeout(removedTimeoutRef.current);
    removedTimeoutRef.current = setTimeout(() => setRecentlyRemoved(null), 6000);
    if (remainingCount === 0) setStage('item-search');
    else setCartHighlight((i) => Math.max(0, Math.min(i, remainingCount - 1)));
  }

  function undoRemove() {
    if (!recentlyRemoved) return;
    setCartLines((lines) => {
      const next = [...lines];
      next.splice(Math.min(recentlyRemoved.index, next.length), 0, recentlyRemoved.line);
      return next;
    });
    clearTimeout(removedTimeoutRef.current);
    setRecentlyRemoved(null);
  }

  function exitCartEdit() {
    setEditingLineIndex(null);
    setEditingQtyValue('');
    setStage('item-search');
  }

  // ---------------- stage 5/6: discount / format ----------------

  function advanceFromDiscount() {
    if (discountExceedsCap) {
      setDiscountError(`Discount exceeds your limit of ${effectiveDiscountCap}%.`);
      return;
    }
    setDiscountError('');
    setPrintFormat(saleType === 'wholesale' ? 'wholesale-a4' : 'retail-thermal');
    setStage('format');
  }

  function toggleFormat(explicit) {
    setPrintFormat(explicit || (printFormat === 'wholesale-a4' ? 'retail-thermal' : 'wholesale-a4'));
  }

  // ---------------- stage 7/8: payment / finalize ----------------

  async function finalizeSale() {
    setFinalizeError('');
    if (partialBlockedNoCustomer) {
      setPaymentError('Select a customer to allow partial payment.');
      return;
    }
    setPaymentError('');

    // Re-validate the discount cap right before finalizing — a cashier's
    // permissions can change mid-shift since this stage was first entered.
    const capRes = await window.api.sales.getCashierDiscountCap({ userId: user.id });
    const freshCap = capRes.capPercentage;
    if (freshCap !== null && discountPercentageEquivalent > freshCap) {
      setDiscountCap(freshCap);
      setDiscountError(`Discount exceeds your limit of ${freshCap}%.`);
      setStage('discount');
      return;
    }

    if (cartLines.length === 0) {
      setFinalizeError('Cart is empty.');
      setStage('item-search');
      return;
    }
    if (hasStockIssue) {
      setFinalizeError('Fix stock issues before completing the sale.');
      setStage('cart-edit');
      return;
    }

    setCompleting(true);
    const payload = {
      saleType,
      customerId: customer?.id || null,
      cashierId: user.id,
      letterheadId,
      items: cartLines.map((l) => ({
        productVariantId: l.variantId,
        productUnitId: l.unitId,
        quantity: Number(l.quantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discountAmount: 0,
        lineTotal: round2((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)),
      })),
      discountAmount,
      paidAmount,
      paymentMethod,
    };

    const res = await window.api.sales.create(payload);
    setCompleting(false);

    if (!res.success) {
      setFinalizeError(res.reason || 'Could not complete sale.');
      return; // cart is preserved on purpose — let the cashier retry
    }

    // Lets the top utility bar's Today's Revenue tile refresh immediately
    // instead of waiting for its next periodic poll.
    window.dispatchEvent(new CustomEvent(SALE_COMPLETED_EVENT));

    const effectiveShowDues = showDues && !!customer;
    const printResult = await window.api.printing.printSale({
      saleId: res.saleId,
      printType: printFormat,
      showDues: effectiveShowDues,
    });

    const finishedTotal = totalAmount;
    const finishedChange = changeDue;
    const finishedBalance = balanceDue;

    clearDraft();
    clearSaleState();
    setConfirmData({
      invoiceNo: res.invoiceNo,
      saleId: res.saleId,
      totalAmount: finishedTotal,
      changeDue: finishedChange,
      balanceDue: finishedBalance,
      printType: printFormat,
      showDues: effectiveShowDues,
      printSuccess: printResult.success,
      printReason: printResult.reason,
      // For wholesale-a4, printA4Invoice.js writes the merged PDF out and
      // returns its path even when the physical print itself failed — the
      // on-screen preview below embeds this directly rather than re-fetching.
      pdfPath: printResult.pdfPath || null,
    });
    setStage('confirm');
  }

  async function retryPrint() {
    if (!confirmData) return;
    setRetryingPrint(true);
    const res = await window.api.printing.printSale({
      saleId: confirmData.saleId,
      printType: confirmData.printType,
      showDues: confirmData.showDues,
    });
    setRetryingPrint(false);
    setConfirmData((d) => ({ ...d, printSuccess: res.success, printReason: res.reason, pdfPath: res.pdfPath || d.pdfPath }));
  }

  function dismissConfirm() {
    setConfirmData(null);
    setStage('idle');
  }

  // ---------------- cancel-sale ----------------

  function requestCancelSale() {
    setShowCancelConfirm(true);
  }
  function confirmCancelSale() {
    setShowCancelConfirm(false);
    clearDraft();
    clearSaleState();
    setStage('idle');
  }
  function dismissCancelConfirm() {
    setShowCancelConfirm(false);
  }

  // ---------------- central keyboard handler ----------------

  function handleKeyDown(e) {
    if (showCancelConfirm) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmCancelSale();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        dismissCancelConfirm();
      }
      return;
    }

    if (stage === 'confirm') {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        dismissConfirm();
      } else if ((e.key === 'r' || e.key === 'R') && confirmData && !confirmData.printSuccess) {
        e.preventDefault();
        retryPrint();
      }
      return;
    }

    if (stage === 'idle') {
      if (draftAvailable) {
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          resumeDraft();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          discardDraftAndStart();
        }
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        startSale();
      }
      return;
    }

    if (stage === 'customer') {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (cartLines.length > 0) requestCancelSale();
        else setStage('idle');
      } else if (e.key === 'ArrowDown' && customerResults.length > 0) {
        e.preventDefault();
        setCustomerHighlight((i) => Math.min(i + 1, customerResults.length - 1));
      } else if (e.key === 'ArrowUp' && customerResults.length > 0) {
        e.preventDefault();
        setCustomerHighlight((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && customerResults[customerHighlight]) {
        e.preventDefault();
        selectCustomerResult(customerResults[customerHighlight]);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        proceedFromCustomerAsWalkIn();
      }
      return;
    }

    if (stage === 'item-search') {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestCancelSale();
        return;
      }
      const dropdownOpen = searchResults.length > 0;
      if (dropdownOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSearchNavigated(true);
          setSearchHighlight((i) => {
            const n = Math.min(i + 1, searchResults.length - 1);
            resetSelectorsForIndex(n);
            return n;
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSearchNavigated(true);
          setSearchHighlight((i) => {
            const n = Math.max(i - 1, 0);
            resetSelectorsForIndex(n);
            return n;
          });
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const group = searchResults[searchHighlight];
          if (group && group.types.length > 1) setActiveSelector((s) => (s === 'type' ? 'unit' : 'type'));
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const group = searchResults[searchHighlight];
          if (!group) return;
          const delta = e.key === 'ArrowRight' ? 1 : -1;
          if (activeSelector === 'type' && group.types.length > 1) {
            setTypeIndex((i) => (i + delta + group.types.length) % group.types.length);
          } else {
            setUnitIndex((i) => (i + delta + group.units.length) % group.units.length);
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleItemSearchEnter();
        }
      } else {
        if (e.key === 'Tab') {
          e.preventDefault();
          if (cartLines.length === 0) {
            setItemSearchMessage('Add at least one item first');
            return;
          }
          setItemSearchMessage('');
          setStage('discount');
        } else if (e.key === 'ArrowUp' && cartLines.length > 0) {
          e.preventDefault();
          enterCartEdit();
        } else if (e.key === 'Enter' && searchQuery.trim()) {
          e.preventDefault();
          handleItemSearchEnter();
        }
      }
      return;
    }

    if (stage === 'qty') {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmQty();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelPendingItem();
      }
      return;
    }

    if (stage === 'cart-edit') {
      if (editingLineIndex !== null) {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmEditCartLine();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelEditCartLine();
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveCartHighlight(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveCartHighlight(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        startEditCartLine();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeCartLineAt(cartHighlight);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        exitCartEdit();
      } else if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undoRemove();
      }
      return;
    }

    if (stage === 'discount') {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestCancelSale();
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        advanceFromDiscount();
      }
      return;
    }

    if (stage === 'format') {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestCancelSale();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        toggleFormat();
      } else if (e.key === '1') {
        e.preventDefault();
        setPrintFormat('wholesale-a4');
      } else if (e.key === '2') {
        e.preventDefault();
        setPrintFormat('retail-thermal');
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        setStage('payment');
      }
      return;
    }

    if (stage === 'payment') {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (partialBlockedNoCustomer) {
          setPaymentError('');
          setStage('customer');
        } else {
          requestCancelSale();
        }
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setPaymentMethod('cash');
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setPaymentMethod('bank');
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setPaymentMethod('other');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        finalizeSale();
      }
      return;
    }
  }

  useEffect(() => {
    handlerRef.current = handleKeyDown;
  });

  useEffect(() => {
    function listener(e) {
      handlerRef.current(e);
    }
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  // ---------------- contextual legend ----------------

  function getLegend() {
    return getStageLegend(stage, {
      draftAvailable,
      searchResultsOpen: searchResults.length > 0,
      editingLine: editingLineIndex !== null,
      partialBlockedNoCustomer,
      confirmData,
    });
  }

  if (!canSell) {
    return (
      <div style={styles.accessDenied}>
        <h3 style={{ margin: 0 }}>You don't have access to this page</h3>
        <p style={{ color: theme.colors.textSecondary }}>Ask your admin to grant you the "make sale" permission.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.legendBar}>
        <span style={styles.legendStage}>{STAGE_LABELS[stage]}</span>
        <span style={styles.legendKeys}>{getLegend()}</span>
      </div>

      {showCancelConfirm && (
        <div style={styles.cancelBanner}>
          Cancel this sale? <strong>Enter</strong> to confirm, <strong>Esc</strong> to keep working.
        </div>
      )}

      {recentlyRemoved && (
        <div style={styles.undoBanner}>
          <span>
            Removed {recentlyRemoved.line.productName} ({recentlyRemoved.line.variantName !== 'Standard' ? recentlyRemoved.line.variantName : recentlyRemoved.line.baseUnitName})
          </span>
          <button style={styles.undoLink} onClick={undoRemove}>
            Ctrl+Z to undo
          </button>
        </div>
      )}

      {finalizeError && <div style={styles.errorBanner}>{finalizeError}</div>}
      {customerNote && stage !== 'customer' && <div style={styles.noteBanner}>{customerNote}</div>}

      {stage === 'idle' && (
        <div style={styles.idleCard}>
          {draftAvailable ? (
            <>
              <div style={styles.idleTitle}>Resume previous sale?</div>
              <div style={styles.idleHint}>
                Press <strong>R</strong> to resume, <strong>N</strong> to start new.
              </div>
            </>
          ) : (
            <>
              <div style={styles.idleTitle}>No sale in progress</div>
              <div style={styles.idleHint}>
                Press <strong>S</strong> to start a new sale.
              </div>
            </>
          )}
        </div>
      )}

      {stage !== 'idle' && stage !== 'confirm' && (
        <div style={styles.columns}>
          {/* -------- left: item search -------- */}
          <div style={styles.leftCol}>
            <div style={{ ...styles.panel, ...(stage === 'item-search' || stage === 'qty' ? styles.panelActive : {}) }}>
              <div style={styles.panelHeader}>Add Items</div>

              {stage === 'qty' && pendingItem ? (
                <div style={styles.qtyBox}>
                  <div style={styles.qtyItemName}>
                    {pendingItem.productName}
                    {pendingItem.variantName !== 'Standard' ? ` — ${pendingItem.variantName}` : ''}
                  </div>
                  <div style={styles.qtyItemMeta}>
                    {formatCurrency(pendingItem.unitPrice)} / {pendingItem.units.find((u) => u.id === pendingItem.unitId)?.unitName}
                  </div>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    value={qtyValue}
                    onChange={(e) => setQtyValue(e.target.value)}
                    style={{ ...styles.qtyStageInput, ...(qtyStockError ? styles.inputError : {}) }}
                  />
                  {qtyStockError && <div style={styles.fieldError}>{qtyStockError}</div>}
                </div>
              ) : (
                <>
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Scan barcode or search by name / SKU…"
                    style={styles.searchInput}
                    disabled={stage !== 'item-search'}
                  />
                  {itemSearchMessage && <div style={styles.fieldError}>{itemSearchMessage}</div>}

                  <div style={styles.resultsList}>
                    {searchResults.map((group, idx) => {
                      const isHighlighted = idx === searchHighlight;
                      const hasTypes = group.types.length > 1;
                      return (
                        <div
                          key={group.productId}
                          style={{ ...styles.resultRow, ...(isHighlighted ? styles.resultRowActive : {}) }}
                          onClick={() => {
                            setSearchHighlight(idx);
                            resetSelectorsForIndex(idx);
                          }}
                        >
                          <div style={styles.resultName}>{group.productName}</div>
                          {hasTypes && (
                            <div style={styles.chipRow}>
                              {group.types.map((t, tIdx) => (
                                <span
                                  key={t.variantId}
                                  style={{ ...styles.chip, ...(isHighlighted && activeSelector === 'type' && tIdx === typeIndex ? styles.chipActive : {}) }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchHighlight(idx);
                                    setActiveSelector('type');
                                    setTypeIndex(tIdx);
                                  }}
                                >
                                  {t.variantName}
                                </span>
                              ))}
                            </div>
                          )}
                          <div style={styles.chipRow}>
                            {group.units.map((u, uIdx) => (
                              <span
                                key={u.id}
                                style={{ ...styles.chip, ...(isHighlighted && activeSelector === 'unit' && uIdx === unitIndex ? styles.chipActive : {}) }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectSearchResult(group, hasTypes ? typeIndex : 0, uIdx);
                                }}
                              >
                                {u.unitName}: {formatCurrency(saleType === 'wholesale' ? u.wholesalePrice : u.retailPrice)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {searchQuery.trim() && searchResults.length === 0 && <div style={styles.resultMeta}>No matches.</div>}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* -------- center: customer + cart -------- */}
          <div style={styles.centerCol}>
            <div style={{ ...styles.panel, ...(stage === 'customer' ? styles.panelActive : {}) }}>
              <div style={styles.panelHeader}>Customer</div>
              {stage === 'customer' ? (
                <>
                  <input
                    ref={customerInputRef}
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Search existing customer, or leave blank for Walk-in…"
                    style={styles.searchInput}
                  />
                  <div style={styles.resultsList}>
                    {customerResults.map((c, idx) => (
                      <div
                        key={c.id}
                        style={{ ...styles.resultRow, ...(idx === customerHighlight ? styles.resultRowActive : {}) }}
                        onClick={() => selectCustomerResult(c)}
                      >
                        <div style={styles.resultName}>{c.name}</div>
                        <div style={styles.resultMeta}>
                          <span style={{ textTransform: 'capitalize' }}>{c.customer_type}</span>
                          {c.phone ? ` · ${c.phone}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={styles.selectedCustomer}>
                  {customer ? (
                    <>
                      <div style={styles.resultName}>{customer.name}</div>
                      <div style={styles.resultMeta}>
                        <span style={{ textTransform: 'capitalize' }}>{customer.customer_type}</span>
                        {customer.phone ? ` · ${customer.phone}` : ''}
                      </div>
                    </>
                  ) : (
                    <div style={styles.resultMeta}>Walk-in Customer</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ ...styles.panel, ...(stage === 'cart-edit' ? styles.panelActive : {}), flex: 1, minHeight: 0, marginTop: '12px', display: 'flex', flexDirection: 'column' }}>
              <div style={styles.panelHeader}>Cart</div>
              {cartLines.length === 0 ? (
                <div style={styles.resultMeta}>Cart is empty — search or scan an item to add it.</div>
              ) : (
                <div style={{ ...styles.resultsList, flex: 1 }}>
                  {cartLines.map((line, idx) => {
                    const isCartEditActive = stage === 'cart-edit' && idx === cartHighlight;
                    const isEditingThis = editingLineIndex === idx;
                    const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                    return (
                      <div
                        key={line.key}
                        style={{
                          ...styles.cartLine,
                          ...(stockIssues[line.key] ? styles.cartLineWarning : {}),
                          ...(isCartEditActive ? styles.cartLineActive : {}),
                        }}
                        onClick={() => {
                          // Mouse fallback — clicking a line from any stage
                          // (not just once already in cart-edit) jumps
                          // straight into editing it, same destination the
                          // ↑-from-empty-search keyboard path reaches.
                          if (stage === 'cart-edit') {
                            setCartHighlight(idx);
                          } else if (stage === 'item-search' && !searchQuery.trim()) {
                            setCartHighlight(idx);
                            setStage('cart-edit');
                          }
                        }}
                      >
                        <div style={styles.lineTop}>
                          <div style={styles.lineName}>
                            {line.productName}
                            {line.variantName !== 'Standard' ? ` — ${line.variantName}` : ''}
                          </div>
                          <div style={styles.lineTotal}>{formatCurrency(lineTotal)}</div>
                        </div>
                        {isEditingThis ? (
                          <div style={styles.lineRow}>
                            <input
                              ref={editQtyInputRef}
                              type="number"
                              value={editingQtyValue}
                              onChange={(e) => setEditingQtyValue(e.target.value)}
                              style={{ ...styles.editQtyInput, ...(editingQtyStockError ? styles.inputError : {}) }}
                            />
                            <span style={styles.resultMeta}>{line.units.find((u) => u.id === line.unitId)?.unitName}</span>
                            {editingQtyStockError && <div style={styles.fieldError}>{editingQtyStockError}</div>}
                          </div>
                        ) : (
                          <div style={styles.lineRow}>
                            <span style={styles.resultMeta}>
                              {line.quantity} {line.units.find((u) => u.id === line.unitId)?.unitName || line.baseUnitName} × {formatCurrency(line.unitPrice)}
                            </span>
                            {isAdmin && (
                              <span style={styles.resultMeta}>
                                Cost {formatCurrency(line.costPrice)} · Margin {formatCurrency(lineTotal - (Number(line.quantity) || 0) * (Number(line.costPrice) || 0))}
                              </span>
                            )}
                          </div>
                        )}
                        {stockIssues[line.key] && <div style={styles.fieldError}>Not enough stock — only {line.stockQty} {line.baseUnitName} available.</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* -------- right: discount / format / payment -------- */}
          <div style={styles.rightCol}>
            <Row label="Subtotal" value={formatCurrency(subtotal)} />

            <div style={{ ...styles.panel, ...(stage === 'discount' ? styles.panelActive : {}) }}>
              <div style={styles.panelHeader}>Discount</div>
              <div style={styles.discountRow}>
                <select
                  style={styles.modeSelect}
                  value={discountMode}
                  onChange={(e) => setDiscountMode(e.target.value)}
                  disabled={stage !== 'discount'}
                >
                  <option value="percentage">%</option>
                  <option value="fixed">Rs</option>
                </select>
                <input
                  ref={discountInputRef}
                  type="number"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  disabled={stage !== 'discount'}
                  style={styles.discountValInput}
                />
              </div>
              {effectiveDiscountCap !== null && effectiveDiscountCap !== undefined && (
                <div style={styles.resultMeta}>Your limit: {effectiveDiscountCap}%</div>
              )}
              {discountError && <div style={styles.fieldError}>{discountError}</div>}
            </div>

            <Row label="Discount Amount" value={`− ${formatCurrency(discountAmount)}`} />
            <Row label="Total" value={formatCurrency(totalAmount)} bold />

            <div style={{ ...styles.panel, ...(stage === 'format' ? styles.panelActive : {}) }}>
              <div style={styles.panelHeader}>Receipt Format</div>
              <div style={styles.formatGrid}>
                <button
                  style={{ ...styles.formatBtn, ...(printFormat === 'wholesale-a4' ? styles.formatBtnActive : {}) }}
                  onClick={() => toggleFormat('wholesale-a4')}
                  disabled={stage !== 'format'}
                >
                  Wholesale (A4)
                </button>
                <button
                  style={{ ...styles.formatBtn, ...(printFormat === 'retail-thermal' ? styles.formatBtnActive : {}) }}
                  onClick={() => toggleFormat('retail-thermal')}
                  disabled={stage !== 'format'}
                >
                  Retail (Thermal)
                </button>
              </div>
            </div>

            <div style={{ ...styles.panel, ...(stage === 'payment' ? styles.panelActive : {}) }}>
              <div style={styles.panelHeader}>Payment</div>
              <div style={styles.resultMeta}>Amount Tendered (blank = exact)</div>
              <input
                type="number"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                disabled={stage !== 'payment'}
                style={styles.discountValInput}
              />
              <div style={styles.paymentMethodRow}>
                {['cash', 'bank', 'other'].map((m) => (
                  <span key={m} style={{ ...styles.methodChip, ...(paymentMethod === m ? styles.methodChipActive : {}) }}>
                    {m === 'cash' ? 'C' : m === 'bank' ? 'B' : 'O'} {m}
                  </span>
                ))}
              </div>
              {customer && (
                <label style={styles.duesToggleLabel}>
                  <input
                    type="checkbox"
                    checked={showDues}
                    onChange={(e) => {
                      setShowDuesTouched(true);
                      setShowDues(e.target.checked);
                    }}
                    disabled={stage !== 'payment'}
                  />
                  Show Outstanding Balance on Receipt
                </label>
              )}
              {changeDue > 0 && <Row label="Change Due" value={formatCurrency(changeDue)} bold />}
              {balanceDue > 0 && <Row label="Balance Due" value={formatCurrency(balanceDue)} bold />}
              {paymentError && <div style={styles.fieldError}>{paymentError}</div>}
              {completing && <div style={styles.resultMeta}>Completing…</div>}
            </div>
          </div>
        </div>
      )}

      {stage === 'confirm' && confirmData && (
        <div style={styles.overlay}>
          <div style={styles.confirmCard}>
            <h3 style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>Sale Completed</h3>
            <div style={styles.resultMeta}>Invoice {confirmData.invoiceNo}</div>
            <div style={styles.confirmTotal}>{formatCurrency(confirmData.totalAmount)}</div>
            {confirmData.changeDue > 0 && <Row label="Change Due" value={formatCurrency(confirmData.changeDue)} bold />}
            {confirmData.balanceDue > 0 && <Row label="Balance Due" value={formatCurrency(confirmData.balanceDue)} bold />}

            {confirmData.printSuccess ? (
              <div style={{ color: theme.colors.success, fontSize: theme.font.sizeSm, marginTop: theme.spacing.sm }}>Receipt sent to print.</div>
            ) : (
              <div style={styles.warningBox}>
                {confirmData.printReason || 'Could not print receipt — check the printer.'}
                <button style={styles.retryBtn} onClick={retryPrint} disabled={retryingPrint}>
                  {retryingPrint ? 'Retrying…' : 'Retry Print (R)'}
                </button>
              </div>
            )}

            {/* Always shown, regardless of whether the physical print
                succeeded — this is the cashier's visual confirmation the
                sale went through, separate from whether paper came out.
                A4 embeds the exact merged PDF that was (or would be) sent to
                the printer; thermal renders the same shared content the
                physical print formats from. */}
            <div style={styles.receiptPreviewWrap}>
              {confirmData.printType === 'wholesale-a4' ? (
                confirmData.pdfPath ? (
                  <embed src={toFileUrl(confirmData.pdfPath)} type="application/pdf" style={styles.receiptPreviewPdf} />
                ) : (
                  <div style={styles.resultMeta}>No invoice preview available — see the message above.</div>
                )
              ) : receiptPreview ? (
                <div style={styles.receiptPreviewThermal}>
                  <ThermalContent data={receiptPreview.data} settings={receiptPreview.settings} />
                </div>
              ) : (
                <div style={styles.resultMeta}>Loading receipt preview…</div>
              )}
            </div>

            <button style={styles.closeBtn} onClick={dismissConfirm}>
              Close (Enter / Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 2px',
        color: bold ? theme.colors.textPrimary : theme.colors.textSecondary,
        fontWeight: bold ? theme.font.weightSemibold : theme.font.weightNormal,
        fontSize: bold ? theme.font.sizeMd : theme.font.sizeSm,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: theme.font.family },
  legendBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.sidebarBackground,
    color: theme.colors.textOnSidebarActive,
    padding: '8px 16px',
    borderRadius: theme.radius.md,
    marginBottom: '10px',
    fontSize: theme.font.sizeSm,
  },
  legendStage: { fontWeight: theme.font.weightSemibold },
  legendKeys: { color: theme.colors.textOnSidebar, fontSize: theme.font.sizeXs },
  cancelBanner: {
    backgroundColor: theme.colors.dangerBackground,
    color: theme.colors.danger,
    border: `1px solid ${theme.colors.danger}`,
    padding: '10px 16px',
    borderRadius: theme.radius.md,
    marginBottom: '10px',
    fontSize: theme.font.sizeSm,
  },
  undoBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.warningBackground,
    color: theme.colors.warning,
    border: `1px solid ${theme.colors.warning}`,
    padding: '8px 16px',
    borderRadius: theme.radius.md,
    marginBottom: '10px',
    fontSize: theme.font.sizeSm,
  },
  undoLink: { background: 'none', border: 'none', color: theme.colors.warning, textDecoration: 'underline', cursor: 'pointer', fontSize: theme.font.sizeSm },
  errorBanner: {
    backgroundColor: theme.colors.dangerBackground,
    color: theme.colors.danger,
    border: `1px solid ${theme.colors.danger}`,
    padding: '8px 16px',
    borderRadius: theme.radius.md,
    marginBottom: '10px',
    fontSize: theme.font.sizeSm,
  },
  noteBanner: {
    backgroundColor: theme.colors.infoBackground,
    color: theme.colors.info,
    border: `1px solid ${theme.colors.info}`,
    padding: '8px 16px',
    borderRadius: theme.radius.md,
    marginBottom: '10px',
    fontSize: theme.font.sizeSm,
  },
  idleCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    gap: '8px',
  },
  idleTitle: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, color: theme.colors.textPrimary },
  idleHint: { color: theme.colors.textSecondary, fontSize: theme.font.sizeBase },
  columns: { display: 'flex', gap: '14px', flex: 1, minHeight: 0 },
  leftCol: { flex: '1.1', minWidth: 0, display: 'flex', flexDirection: 'column' },
  centerCol: { flex: '1.4', minWidth: 0, display: 'flex', flexDirection: 'column' },
  rightCol: { flex: '1', minWidth: '280px', maxWidth: '340px', overflowY: 'auto' },
  panel: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    padding: theme.spacing.md,
    marginBottom: '10px',
    transition: 'border-color 0.15s ease',
  },
  panelActive: { borderColor: theme.colors.primary, borderWidth: '2px' },
  panelHeader: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' },
  searchInput: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeMd,
    boxSizing: 'border-box',
  },
  resultsList: { marginTop: '10px', overflowY: 'auto', maxHeight: '100%' },
  resultRow: {
    padding: '10px',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  resultRowActive: { backgroundColor: theme.colors.infoBackground, borderLeft: `3px solid ${theme.colors.primary}` },
  resultName: { color: theme.colors.textPrimary, fontSize: theme.font.sizeBase, fontWeight: theme.font.weightMedium },
  resultMeta: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginTop: '2px' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' },
  chip: {
    padding: '3px 8px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.appBackground,
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeXs,
    cursor: 'pointer',
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, color: theme.colors.primaryText, fontWeight: theme.font.weightSemibold },
  selectedCustomer: { padding: '4px 0' },
  qtyBox: { display: 'flex', flexDirection: 'column', gap: '6px' },
  qtyItemName: { color: theme.colors.textPrimary, fontSize: theme.font.sizeMd, fontWeight: theme.font.weightSemibold },
  qtyItemMeta: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm },
  qtyStageInput: {
    width: '140px',
    padding: '12px',
    fontSize: theme.font.sizeLg,
    borderRadius: theme.radius.md,
    border: `2px solid ${theme.colors.primary}`,
    textAlign: 'center',
  },
  inputError: { borderColor: theme.colors.danger },
  fieldError: { color: theme.colors.danger, fontSize: theme.font.sizeXs, marginTop: '4px' },
  cartLine: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: '8px 10px', marginBottom: '6px' },
  cartLineWarning: { borderColor: theme.colors.warning },
  cartLineActive: { borderColor: theme.colors.primary, borderWidth: '2px', backgroundColor: theme.colors.infoBackground },
  lineTop: { display: 'flex', justifyContent: 'space-between' },
  lineName: { color: theme.colors.textPrimary, fontSize: theme.font.sizeSm, fontWeight: theme.font.weightMedium },
  lineTotal: { color: theme.colors.textPrimary, fontWeight: theme.font.weightSemibold, fontSize: theme.font.sizeSm },
  lineRow: { display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' },
  editQtyInput: { width: '70px', padding: '5px 8px', borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.primary}`, fontSize: theme.font.sizeSm },
  discountRow: { display: 'flex', gap: '8px' },
  modeSelect: { padding: '8px', borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`, fontSize: theme.font.sizeSm },
  discountValInput: {
    flex: 1,
    width: '100%',
    padding: '9px 10px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.font.sizeSm,
    boxSizing: 'border-box',
    marginTop: '6px',
  },
  formatGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  formatBtn: {
    padding: '10px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeSm,
    fontWeight: theme.font.weightMedium,
    cursor: 'pointer',
  },
  formatBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.infoBackground, color: theme.colors.primary },
  paymentMethodRow: { display: 'flex', gap: '6px', marginTop: '8px' },
  methodChip: {
    padding: '4px 10px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeXs,
    textTransform: 'capitalize',
  },
  methodChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, color: theme.colors.primaryText },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  confirmCard: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.dropdown,
    padding: '28px',
    width: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    textAlign: 'center',
  },
  confirmTotal: { fontSize: theme.font.sizeXl, fontWeight: theme.font.weightSemibold, color: theme.colors.primary, margin: '8px 0' },
  warningBox: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.warningBackground,
    color: theme.colors.warning,
    border: `1px solid ${theme.colors.warning}`,
    borderRadius: theme.radius.md,
    padding: '10px',
    fontSize: theme.font.sizeSm,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  retryBtn: {
    padding: '8px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.warning}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.warning,
    cursor: 'pointer',
    fontSize: theme.font.sizeSm,
  },
  closeBtn: {
    marginTop: theme.spacing.lg,
    width: '100%',
    padding: '12px',
    borderRadius: theme.radius.md,
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: theme.colors.primaryText,
    cursor: 'pointer',
    fontSize: theme.font.sizeBase,
    fontWeight: theme.font.weightSemibold,
  },
  duesToggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '10px',
    fontSize: theme.font.sizeSm,
    color: theme.colors.textPrimary,
    cursor: 'pointer',
  },
  // The preview content itself is styled black-on-white/print-appropriate —
  // this wrapper just gives it a bordered "sheet of paper" frame inside the
  // otherwise dark-chrome confirm card. A4 embeds the actual merged PDF
  // (Chromium's built-in PDF viewer handles the <embed>); thermal renders
  // ThermalContent, the same shared component the dev-mode preview uses.
  receiptPreviewWrap: { marginTop: theme.spacing.md, textAlign: 'left' },
  receiptPreviewPdf: {
    width: '100%',
    height: '440px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
  },
  receiptPreviewThermal: {
    backgroundColor: '#ffffff',
    color: '#000000',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '16px',
    maxHeight: '360px',
    overflowY: 'auto',
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
    lineHeight: '1.6',
  },
  accessDenied: { padding: '40px', color: theme.colors.textPrimary, fontFamily: theme.font.family },
};
