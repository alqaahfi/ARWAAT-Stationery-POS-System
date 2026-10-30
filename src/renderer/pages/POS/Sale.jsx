import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import glossary from '../../config/glossary';
import theme from '../../config/theme';
import { formatCount } from '../../utils/format';
import { Card, EmptyState, useToast } from '../../components/ui';
import StepStrip from './parts/StepStrip';
import IdlePanel from './parts/IdlePanel';
import CustomerPanel from './parts/CustomerPanel';
import ItemSearchPanel from './parts/ItemSearchPanel';
import QtyPanel from './parts/QtyPanel';
import MultiTypeQtyPanel, { entriesFromValues } from '../../components/billing/MultiTypeQtyPanel';
import DiscountPanel from './parts/DiscountPanel';
import FormatPanel from './parts/FormatPanel';
import PaymentPanel from './parts/PaymentPanel';
import CartList from './parts/CartList';
import SummaryCard from './parts/SummaryCard';
import KeyHints, { getKeyHints } from './parts/KeyHints';
import UndoPill from './parts/UndoPill';
import RecentBillsPanel from './parts/RecentBillsPanel';
import HeldBillsPanel from './parts/HeldBillsPanel';
import CancelSaleDialog from './parts/CancelSaleDialog';
import SaleCompleteSheet from './parts/SaleCompleteSheet';
import PrintPreviewModal from '../../components/receipt/PrintPreviewModal';
import BillOverlay from '../../components/billing/BillOverlay';
import Returns from '../Sales/Returns';
import { InlineMessage, PanelTitle, packSizeName } from './parts/common';
import { whileSaving } from '../../utils/appEvents';

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

// Held bills: any number of parked carts, kept per station in localStorage.
function heldKey(stationCode) {
  return `pos_held_bills_${stationCode || 'MAIN'}`;
}

function readHeld(stationCode) {
  try {
    const list = JSON.parse(localStorage.getItem(heldKey(stationCode)) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Sold + free units both leave the shelf.
const lineUnits = (l) => (Number(l.quantity) || 0) + (Number(l.focQuantity) || 0);

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

// Plain-text legend per stage, kept for any shortcuts reference. The on-screen
// key-hints bar is built by parts/KeyHints.jsx from the same handler below.
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
        : '↑↓ Edit Cart · Ctrl+←/→ Change Step · Tab Continue to Discount · F6 Return · Esc Cancel Sale';
    case 'qty':
      return 'Enter Add to Cart · Esc Cancel Item';
    case 'cart-edit':
      return editingLine
        ? 'Enter Confirm Qty · Esc Cancel Edit'
        : '↑↓ Select Line · Enter/E Edit Qty · Del Remove · Ctrl+Z Undo · Esc Back to Search';
    case 'discount':
      return 'Tab / Enter Continue · Esc Cancel Sale';
    case 'format':
      return '←→ or 1/2 Toggle Format · Tab / Enter Continue · Esc Cancel Sale';
    case 'payment':
      return partialBlockedNoCustomer ? 'C/B/O Payment Method · Esc Select a Customer' : 'Enter Exact Payment · C/B/O Method · Esc Cancel Sale';
    case 'confirm':
      return confirmData && !confirmData.printSuccess ? 'Enter / Esc Close · R Print' : 'Enter / Esc Close';
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
  const toast = useToast();

  // ---------------- stage machine ----------------
  const [stage, setStage] = useState('idle');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [stationCode, setStationCode] = useState('MAIN');
  const [showRecent, setShowRecent] = useState(false);
  const [showRecall, setShowRecall] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [heldBills, setHeldBills] = useState([]);
  // Set while an existing bill is loaded for editing: { id, invoiceNo, customerId, owedBySale }.
  const [editingSale, setEditingSale] = useState(null);

  // ---------------- sale data ----------------
  const [customer, setCustomer] = useState(null);
  const [letterheadId, setLetterheadId] = useState(null);
  const [cartLines, setCartLines] = useState([]);
  // Base units added by scans that the cart state has not rendered yet (back-to-back scans).
  const scanPendingRef = useRef({});
  useEffect(() => { scanPendingRef.current = {}; }, [cartLines]);
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
  const [focValue, setFocValue] = useState('');
  // Product with several Types: quantities for all Types are typed on one panel.
  const [multiTypes, setMultiTypes] = useState(null); // [{ variantId, variantName, stockQty }] | null
  const [multiValues, setMultiValues] = useState({});
  const [multiError, setMultiError] = useState('');

  // ---------------- stage 4: cart-edit ----------------
  const [cartHighlight, setCartHighlight] = useState(0);
  const [editingLineIndex, setEditingLineIndex] = useState(null);
  const [editingQtyValue, setEditingQtyValue] = useState('');
  const [editingFocValue, setEditingFocValue] = useState('');
  const [recentlyRemoved, setRecentlyRemoved] = useState(null);

  // ---------------- errors ----------------
  const [discountError, setDiscountError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [finalizeError, setFinalizeError] = useState('');

  // ---------------- finalize ----------------
  const [completing, setCompleting] = useState(false);
  const [confirmData, setConfirmData] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  // The on-screen receipt/invoice preview shown alongside the confirmation —
  // always fetched and shown regardless of whether the physical print
  // succeeded, via the same buildReceiptData() shape the print paths use.
  const [receiptPreview, setReceiptPreview] = useState(null);

  // ---------------- refs ----------------
  const customerInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const editQtyInputRef = useRef(null);
  const focInputRef = useRef(null);
  const editFocInputRef = useRef(null);
  // Loading a saved bill sets the customer; its stored prices must survive that.
  const skipRepriceRef = useRef(false);
  const discountInputRef = useRef(null);
  const amountInputRef = useRef(null);
  const removedTimeoutRef = useRef(null);
  const handlerRef = useRef(() => {});

  // ---------------- mount: discount cap + station code ----------------
  useEffect(() => {
    window.api.sales.getCashierDiscountCap({ userId: user.id }).then((res) => setDiscountCap(res.capPercentage));
    window.api.setup.getStatus().then((res) => setStationCode(res.stationCode || 'MAIN'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    setDraftAvailable(!!localStorage.getItem(draftKey(stationCode)));
    setHeldBills(readHeld(stationCode));
  }, [stationCode]);

  // Re-resolve every line's price whenever the customer changes (net-rate /
  // percentage rules key off the customer, retail vs wholesale too).
  useEffect(() => {
    if (skipRepriceRef.current) {
      skipRepriceRef.current = false;
      return;
    }
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
    if (stage === 'idle' || stage === 'confirm' || editingSale) return;
    if (cartLines.length === 0 && !customer) return;
    const t = setTimeout(() => {
      const draft = {
        customerId: customer?.id || null,
        lines: cartLines.map((l) => ({ variantId: l.variantId, unitId: l.unitId, quantity: l.quantity, focQuantity: l.focQuantity || 0 })),
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
  }, [customer, cartLines, discountMode, discountInput, stage, stationCode, editingSale]);

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
    else if (stage === 'payment') amountInputRef.current?.focus();
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
    if (lineUnits(line) * line.conversionFactor > line.stockQty) stockIssues[line.key] = true;
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

  // Live ledger preview: what they owed before this bill, and what they will owe after it.
  // Until the payment step the bill counts as unpaid, so the figure moves with every cart change.
  const paidForBalance = stage === 'payment' || amountTendered !== '' ? paidAmount : 0;
  const previousBalance = customer && customerBalanceBeforeSale !== null ? customerBalanceBeforeSale : null;
  const newBalance = previousBalance !== null ? round2(previousBalance + totalAmount - paidForBalance) : null;

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
  const focNumber = Math.max(0, Number(focValue) || 0);
  const qtyStockError =
    pendingItem && qtyNumber > 0 && (qtyNumber + focNumber) * pendingItem.conversionFactor > pendingItem.stockQty
      ? `Only ${formatCount(pendingItem.stockQty / pendingItem.conversionFactor)} in stock.`
      : '';

  const editingLine = editingLineIndex !== null ? cartLines[editingLineIndex] : null;
  const editingQtyNumber = Number(editingQtyValue) || 0;
  const editingFocNumber = Math.max(0, Number(editingFocValue) || 0);
  const editingQtyStockError =
    editingLine && editingQtyNumber > 0 && (editingQtyNumber + editingFocNumber) * editingLine.conversionFactor > editingLine.stockQty
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
    setFocValue('');
    setCartHighlight(0);
    setEditingLineIndex(null);
    setEditingQtyValue('');
    setEditingFocValue('');
    setEditingSale(null);
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

  // Rebuilds the cart from a saved snapshot ({ customerId, lines, discountMode, discountInput }) —
  // shared by Resume draft and Recall held bill. Lines are re-priced for the customer.
  async function restoreSnapshot(snap) {
    clearSaleState();

    let restoredCustomer = null;
    if (snap.customerId) {
      restoredCustomer = await window.api.customers.getById({ id: snap.customerId });
      const letterheads = await window.api.letterheads.list();
      skipRepriceRef.current = true;
      setCustomer(restoredCustomer);
      setLetterheadId(restoredCustomer?.assigned_letterhead_id || resolveDefaultLetterheadId(letterheads) || null);
      const ledger = await window.api.customers.getLedger({ id: snap.customerId });
      setCustomerBalanceBeforeSale(ledger.success ? ledger.balance : 0);
    }

    const lines = [];
    for (const dl of snap.lines || []) {
      const detail = await window.api.sales.getVariantForCart({ variantId: dl.variantId });
      if (!detail) continue;
      const unit = detail.units.find((u) => u.id === dl.unitId) || detail.units.find((u) => u.id === detail.defaultUnitId);
      if (!unit) continue;
      const priceRes = await window.api.sales.resolvePrice({ productUnitId: unit.id, customerId: snap.customerId || null });
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
        focQuantity: dl.focQuantity || 0,
        unitPrice: priceRes.price,
        costPrice: unit.costPrice,
      });
    }
    setCartLines(lines);
    setDiscountMode(snap.discountMode || 'percentage');
    setDiscountInput(snap.discountInput || 0);
    setStage(lines.length > 0 || restoredCustomer ? 'item-search' : 'customer');
  }

  async function resumeDraft() {
    const raw = localStorage.getItem(draftKey(stationCode));
    if (!raw) {
      startSale();
      return;
    }
    try {
      await restoreSnapshot(JSON.parse(raw));
    } catch {
      localStorage.removeItem(draftKey(stationCode));
      startSale();
    }
  }

  // ---------------- held bills ----------------

  function saveHeld(list) {
    try {
      localStorage.setItem(heldKey(stationCode), JSON.stringify(list));
    } catch {
      // localStorage unavailable — the hold just won't persist.
    }
    setHeldBills(list);
  }

  // Parks the current cart under a temporary name. Returns false when there is nothing to hold.
  function holdCurrentSale() {
    if (editingSale || (cartLines.length === 0 && !customer)) return false;
    const list = readHeld(stationCode);
    const n = list.reduce((m, h) => Math.max(m, h.number || 0), 0) + 1;
    saveHeld([
      ...list,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        number: n,
        name: `Hold ${n} · ${customer ? customer.name : glossary.walkIn}`,
        createdAt: new Date().toISOString(),
        customerId: customer?.id || null,
        lines: cartLines.map((l) => ({ variantId: l.variantId, unitId: l.unitId, quantity: l.quantity, focQuantity: l.focQuantity || 0 })),
        discountMode,
        discountInput,
      },
    ]);
    return true;
  }

  function holdAndClear() {
    if (!holdCurrentSale()) return;
    clearDraft();
    clearSaleState();
    setStage('idle');
  }

  async function recallHeld(id) {
    const target = readHeld(stationCode).find((h) => h.id === id);
    if (!target) return;
    // Whatever is on screen goes on hold first, so nothing is lost.
    holdCurrentSale();
    saveHeld(readHeld(stationCode).filter((h) => h.id !== id));
    setShowRecall(false);
    clearDraft();
    await restoreSnapshot(target);
  }

  function discardHeld(id) {
    saveHeld(readHeld(stationCode).filter((h) => h.id !== id));
  }

  // ---------------- recent bills: edit ----------------

  // Loads a saved bill back into the sale. Nothing changes in the database until the cashier saves.
  async function editBill(saleId) {
    const res = await window.api.sales.getForEdit({ saleId, userId: user.id });
    if (!res.success) {
      toast.error(res.reason);
      return;
    }
    // Park whatever is on screen first (never lose a half-built sale).
    holdCurrentSale();
    setShowRecent(false);
    clearDraft();
    clearSaleState();

    const { sale } = res;
    // The bill's own stock is given back when saving, so it counts as available while editing.
    const givenBack = {};
    for (const l of res.lines) {
      givenBack[l.product_variant_id] = (givenBack[l.product_variant_id] || 0) + (l.quantity + l.foc_quantity) * l.conversion_factor;
    }

    const lines = [];
    for (const l of res.lines) {
      const detail = await window.api.sales.getVariantForCart({ variantId: l.product_variant_id });
      if (!detail) continue;
      lines.push({
        key: `${l.product_variant_id}-${l.product_unit_id}-${l.id}`,
        variantId: l.product_variant_id,
        variantName: l.variant_name,
        productId: l.product_id,
        productName: l.product_name,
        baseUnitName: l.base_unit_name,
        stockQty: detail.variant.stockQty + givenBack[l.product_variant_id],
        units: detail.units,
        unitId: l.product_unit_id,
        conversionFactor: l.conversion_factor,
        quantity: l.quantity,
        focQuantity: l.foc_quantity || 0,
        unitPrice: l.unit_price,
        costPrice: detail.units.find((u) => u.id === l.product_unit_id)?.costPrice ?? 0,
      });
    }

    const owedBySale = sale.total_amount - sale.paid_amount;
    let balanceBefore = null;
    if (res.customer) {
      const ledger = await window.api.customers.getLedger({ id: res.customer.id });
      // The ledger already includes this bill; take its effect out to get the balance before it.
      balanceBefore = (ledger.success ? ledger.balance : 0) - owedBySale;
      const full = await window.api.customers.getById({ id: res.customer.id });
      skipRepriceRef.current = true;
      setCustomer(full || res.customer);
    }
    const letterheads = await window.api.letterheads.list();
    setLetterheadId(sale.letterhead_id || resolveDefaultLetterheadId(letterheads) || null);
    setCustomerBalanceBeforeSale(balanceBefore);
    setCartLines(lines);
    setDiscountMode('amount');
    setDiscountInput(sale.discount_amount || 0);
    setAmountTendered(String(sale.paid_amount));
    setPaymentMethod(res.paymentMethod || 'cash');
    setEditingSale({ id: sale.id, invoiceNo: sale.invoice_no, customerId: sale.customer_id, owedBySale });
    setStage('item-search');
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
    let balance = ledger.success ? ledger.balance : 0;
    // Editing: if it is the bill's own customer, their balance already includes this bill.
    if (editingSale && editingSale.customerId === c.id) balance -= editingSale.owedBySale;
    setCustomerBalanceBeforeSale(balance);
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
    const allTypes = (await window.api.sales.getProductTypes({ productId: group.productId }).catch(() => [])) || [];
    setMultiTypes(allTypes.length > 1 ? allTypes : null);
    setMultiValues({});
    setMultiError('');
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
    setFocValue('');
    setSearchQuery('');
    setSearchResults([]);
    setStage('qty');
  }

  async function handleItemSearchEnter() {
    // Read the box itself: the key listener is re-bound after every render, so during a burst of scanner
    // keystrokes it can still hold an older searchQuery.
    const raw = (searchInputRef.current ? searchInputRef.current.value : searchQuery).trim();
    if (!raw) return;

    // A scanner sends the next code right after Enter. Empty the box now, before the async
    // lookup, so the next code is not glued onto this one.
    const looksLikeScan = !searchNavigated && /^\d{3,}$/.test(raw);
    if (looksLikeScan) setSearchQuery('');

    if (!searchNavigated) {
      const match = await window.api.sales.getVariantByBarcode({ barcode: raw });
      if (match) {
        const detail = await window.api.sales.getVariantForCart({ variantId: match.variantId });
        if (detail && detail.defaultUnitId) {
          const unit = detail.units.find((u) => u.id === detail.defaultUnitId);
          const priceRes = await window.api.sales.resolvePrice({ productUnitId: detail.defaultUnitId, customerId: customer?.id || null });
          setMultiTypes(null); // a scanned barcode is one specific Type
          // A scanner types the code and presses Enter, then the next code follows at once.
          // So a scan adds ONE unit straight to the cart and leaves the focus in the search
          // box; sending it to the quantity box would swallow the next scan as a quantity.
          // (Quantity can still be changed afterwards in the cart.)
          const inCartBase = cartLines
            .filter((l) => l.variantId === detail.variant.id)
            .reduce((sum, l) => sum + ((Number(l.quantity) || 0) + (Number(l.focQuantity) || 0)) * l.conversionFactor, 0);
          setSearchQuery('');
          setSearchResults([]);
          const pending = scanPendingRef.current[detail.variant.id] || 0;
          if (inCartBase + pending + unit.conversionFactor > detail.variant.stockQty) {
            toast.error(`Only ${formatCount(detail.variant.stockQty / unit.conversionFactor)} in stock for ${detail.product.name}.`);
            return;
          }
          scanPendingRef.current[detail.variant.id] = pending + unit.conversionFactor;
          addOrMergeCartLine({
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
            quantity: 1,
            focQuantity: 0,
          });
          return;
        }
      }
      // Not a known barcode: put the typed text back so the normal search results show.
      if (looksLikeScan) setSearchQuery((cur) => cur || raw);
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
        return lines.map((l, i) =>
          i === idx
            ? { ...l, quantity: round2((Number(l.quantity) || 0) + item.quantity), focQuantity: round2((Number(l.focQuantity) || 0) + (item.focQuantity || 0)) }
            : l
        );
      }
      return [...lines, { key: `${item.variantId}-${item.unitId}-${Date.now()}`, ...item }];
    });
  }

  function confirmMultiQty() {
    if (!pendingItem || !multiTypes) return;
    const entries = entriesFromValues(multiTypes, multiValues);
    if (entries.length === 0) {
      setMultiError('Type a quantity for at least one Type.');
      return;
    }
    const over = entries.find((e) => e.quantity * pendingItem.conversionFactor > e.type.stockQty);
    if (over) {
      setMultiError(`Only ${formatCount(over.type.stockQty / pendingItem.conversionFactor)} of ${over.type.variantName} in stock.`);
      return;
    }
    for (const { type, quantity } of entries) {
      addOrMergeCartLine({ ...pendingItem, variantId: type.variantId, variantName: type.variantName, stockQty: type.stockQty, quantity, focQuantity: 0 });
    }
    cancelPendingItem();
  }

  function confirmQty() {
    if (!pendingItem || qtyNumber <= 0 || qtyStockError) return;
    addOrMergeCartLine({ ...pendingItem, quantity: qtyNumber, focQuantity: focNumber });
    setPendingItem(null);
    setQtyValue('1');
    setFocValue('');
    setSearchQuery('');
    setSearchResults([]);
    setStage('item-search');
  }

  function cancelPendingItem() {
    setMultiTypes(null);
    setMultiValues({});
    setMultiError('');
    setPendingItem(null);
    setQtyValue('1');
    setFocValue('');
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
    setEditingFocValue(line.focQuantity ? String(line.focQuantity) : '');
  }

  function confirmEditCartLine() {
    if (editingLineIndex === null || editingQtyNumber <= 0 || editingQtyStockError) return;
    setCartLines((lines) => lines.map((l, i) => (i === editingLineIndex ? { ...l, quantity: editingQtyNumber, focQuantity: editingFocNumber } : l)));
    setEditingLineIndex(null);
    setEditingQtyValue('');
    setEditingFocValue('');
  }

  function cancelEditCartLine() {
    setEditingLineIndex(null);
    setEditingQtyValue('');
    setEditingFocValue('');
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
        focQuantity: Number(l.focQuantity) || 0,
        unitPrice: Number(l.unitPrice) || 0,
        discountAmount: 0,
        lineTotal: round2((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)),
      })),
      discountAmount,
      paidAmount,
      paymentMethod,
    };

    const res = await whileSaving(() =>
      editingSale ? window.api.sales.update({ ...payload, saleId: editingSale.id }) : window.api.sales.create(payload)
    );
    setCompleting(false);

    if (!res.success) {
      setFinalizeError(res.reason || 'Could not complete sale.');
      return; // cart is preserved on purpose — let the cashier retry
    }

    // Lets the top utility bar's Today's Revenue tile refresh immediately
    // instead of waiting for its next periodic poll.
    window.dispatchEvent(new CustomEvent(SALE_COMPLETED_EVENT));

    const effectiveShowDues = showDues && !!customer;
    // Nothing goes to the printer automatically: the print preview opens
    // first and its Print button does the physical print. The sale is already
    // saved, so closing the preview never affects it.
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
      printSuccess: null,
      printReason: null,
      // Set once the A4 invoice is physically printed (printInvoice returns
      // the merged PDF's path); the confirm sheet embeds it from then on.
      pdfPath: null,
    });
    setStage('confirm');
    setShowPrintPreview(true);
  }

  function onPrinted(res) {
    setConfirmData((d) => ({ ...d, printSuccess: true, printReason: null, pdfPath: res.pdfPath || d.pdfPath }));
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

  // ---------------- Ctrl+Left/Right step navigation ----------------

  function jumpToStep(dir) {
    setItemSearchMessage('');
    if (stage === 'customer') {
      if (dir < 0) return;
      if (customer) setStage('item-search');
      else proceedFromCustomerAsWalkIn();
    } else if (stage === 'item-search' || stage === 'cart-edit') {
      if (dir < 0) {
        setStage('customer');
      } else if (cartLines.length === 0) {
        setItemSearchMessage('Add at least one item first');
      } else {
        setStage('discount');
      }
    } else if (stage === 'discount') {
      if (dir < 0) setStage('item-search');
      else advanceFromDiscount();
    } else if (stage === 'format') {
      setStage(dir < 0 ? 'discount' : 'payment');
    } else if (stage === 'payment') {
      if (dir < 0) setStage('discount');
    }
  }

  // ---------------- central keyboard handler ----------------

  function handleKeyDown(e) {
    // The print preview window owns the keyboard while it is open.
    if (showPrintPreview) return;

    // The Today's bills and Held bills panels run their own keys while open.
    if (showRecent || showRecall || showReturn) return;

    if (e.key === 'F2' || e.key === 'F3' || e.key === 'F4' || (e.key === 'F6' && isAdmin)) {
      if (showCancelConfirm || stage === 'confirm') return;
      e.preventDefault();
      if (e.key === 'F2') setShowRecent(true);
      else if (e.key === 'F3') setShowRecall(true);
      else if (e.key === 'F6') setShowReturn(true);
      else if (stage !== 'idle') holdAndClear();
      return;
    }

    // Ctrl+Left/Right walk the four billing steps: Customer, Items, Discount, Payment.
    if (e.ctrlKey && !e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const step = { customer: 0, 'item-search': 1, 'cart-edit': 1, discount: 2, format: 3, payment: 3 }[stage];
      if (step !== undefined && !showCancelConfirm && editingLineIndex === null) {
        e.preventDefault();
        jumpToStep(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
    }

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
        setShowPrintPreview(true);
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
        } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && cartLines.length > 0 && !searchQuery.trim()) {
          e.preventDefault();
          setCartHighlight(e.key === 'ArrowDown' ? 0 : cartLines.length - 1);
          setStage('cart-edit');
        } else if (e.key === 'Enter' && (searchInputRef.current ? searchInputRef.current.value : searchQuery).trim()) {
          e.preventDefault();
          handleItemSearchEnter();
        }
      }
      return;
    }

    if (stage === 'qty') {
      if (multiTypes) return; // MultiTypeQtyPanel handles its own keys (Tab walks the Types)
      if (e.key === 'Tab') {
        e.preventDefault();
        const next = document.activeElement === focInputRef.current ? qtyInputRef : focInputRef;
        next.current?.focus();
        next.current?.select();
      } else if (e.key === 'Enter') {
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
        if (e.key === 'Tab') {
          e.preventDefault();
          const next = document.activeElement === editFocInputRef.current ? editQtyInputRef : editFocInputRef;
          next.current?.focus();
          next.current?.select();
        } else if (e.key === 'Enter') {
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
      } else if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
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


  // ---------------- presentation ----------------
  // Everything below only renders state and forwards clicks to the handlers
  // above; the visual pieces live in ./parts.

  // Stable callbacks for the memoized result / cart rows, so typing in the
  // search box never re-renders rows that didn't change.
  const rowActionsRef = useRef(null);
  rowActionsRef.current = {
    onResultClick(idx) {
      setSearchHighlight(idx);
      resetSelectorsForIndex(idx);
    },
    onTypeClick(idx, tIdx) {
      setSearchHighlight(idx);
      setActiveSelector('type');
      setTypeIndex(tIdx);
    },
    onUnitClick(group, uIdx) {
      selectSearchResult(group, group.types.length > 1 ? typeIndex : 0, uIdx);
    },
    onCartRowClick(idx) {
      // Mouse fallback — clicking a line from item-search (empty box) jumps
      // into cart-edit, the same place ↑ from an empty search box goes.
      if (stage === 'cart-edit') {
        setCartHighlight(idx);
      } else if (stage === 'item-search' && !searchQuery.trim()) {
        setCartHighlight(idx);
        setStage('cart-edit');
      }
    },
    onCartRemove(idx) {
      removeCartLineAt(idx);
    },
  };
  const resultActions = useMemo(
    () => ({
      onRowClick: (idx) => rowActionsRef.current.onResultClick(idx),
      onTypeClick: (idx, tIdx) => rowActionsRef.current.onTypeClick(idx, tIdx),
      onUnitClick: (group, uIdx) => rowActionsRef.current.onUnitClick(group, uIdx),
    }),
    []
  );
  const cartActions = useMemo(
    () => ({
      onRowClick: (idx) => rowActionsRef.current.onCartRowClick(idx),
      onRemove: (idx) => rowActionsRef.current.onCartRemove(idx),
    }),
    []
  );

  // Item count of the saved draft, for the resume banner (display only).
  const draftItemCount = useMemo(() => {
    if (!draftAvailable) return 0;
    try {
      return JSON.parse(localStorage.getItem(draftKey(stationCode)) || '{}').lines?.length || 0;
    } catch {
      return 0;
    }
  }, [draftAvailable, stationCode]);

  if (!canSell) {
    return (
      <Card padding="0">
        <EmptyState icon={Lock} title="You don't have access to this page" message={'Ask your admin to grant you the "make sale" permission.'} />
      </Card>
    );
  }

  const inSale = stage !== 'idle' && stage !== 'confirm';
  const hints = getKeyHints(stage, {
    cancelOpen: showCancelConfirm,
    draftAvailable,
    resultsOpen: searchResults.length > 0,
    hasQuery: !!searchQuery.trim(),
    cartCount: cartLines.length,
    editingLine: editingLineIndex !== null,
    partialBlocked: partialBlockedNoCustomer,
    amountTyped: amountTendered !== '',
    printFailed: !!confirmData && !confirmData.printSuccess,
  });

  function renderEntry() {
    switch (stage) {
      case 'customer':
        return (
          <CustomerPanel
            inputRef={customerInputRef}
            query={customerQuery}
            onQueryChange={setCustomerQuery}
            results={customerResults}
            highlight={customerHighlight}
            onSelect={selectCustomerResult}
          />
        );
      case 'item-search':
      case 'cart-edit':
        return (
          <ItemSearchPanel
            inputRef={searchInputRef}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            editingCart={stage === 'cart-edit'}
            results={searchResults}
            highlight={searchHighlight}
            activeSelector={activeSelector}
            typeIndex={typeIndex}
            unitIndex={unitIndex}
            saleType={saleType}
            message={itemSearchMessage}
            actions={resultActions}
          />
        );
      case 'qty':
        if (pendingItem && multiTypes) {
          return (
            <>
              <PanelTitle title="How many of each?" hint="Enter adds them all. Press Esc to pick a different item." />
              <MultiTypeQtyPanel
                productName={pendingItem.productName}
                unitLabel={packSizeName(pendingItem)}
                types={multiTypes}
                values={multiValues}
                onChange={(id, v) => {
                  setMultiError('');
                  setMultiValues((prev) => ({ ...prev, [id]: v }));
                }}
                onConfirm={confirmMultiQty}
                onCancel={cancelPendingItem}
                stockOf={(t) => t.stockQty / pendingItem.conversionFactor}
                error={multiError}
              />
            </>
          );
        }
        return pendingItem ? (
          <QtyPanel
            inputRef={qtyInputRef}
            focInputRef={focInputRef}
            item={pendingItem}
            value={qtyValue}
            onChange={setQtyValue}
            focValue={focValue}
            onFocChange={setFocValue}
            lineTotal={qtyNumber * (Number(pendingItem.unitPrice) || 0)}
            stockError={qtyStockError}
          />
        ) : null;
      case 'discount':
        return (
          <DiscountPanel
            inputRef={discountInputRef}
            mode={discountMode}
            onModeChange={setDiscountMode}
            value={discountInput}
            onChange={setDiscountInput}
            cap={effectiveDiscountCap}
            discountAmount={discountAmount}
            error={discountError}
          />
        );
      case 'format':
        return <FormatPanel value={printFormat} onChoose={toggleFormat} />;
      case 'payment':
        return (
          <PaymentPanel
            inputRef={amountInputRef}
            amount={amountTendered}
            onAmountChange={setAmountTendered}
            total={totalAmount}
            changeDue={changeDue}
            balanceDue={balanceDue}
            method={paymentMethod}
            onMethodChange={setPaymentMethod}
            showDuesOption={!!customer}
            showDues={showDues}
            onShowDuesChange={(checked) => {
              setShowDuesTouched(true);
              setShowDues(checked);
            }}
            blockedNoCustomer={partialBlockedNoCustomer}
            error={paymentError}
            completing={completing}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div style={styles.container}>
      <StepStrip
        stage={stage}
        showCancel={inSale}
        onCancel={requestCancelSale}
        heldCount={heldBills.length}
        canHold={inSale && !editingSale}
        onRecent={() => setShowRecent(true)}
        onRecall={() => setShowRecall(true)}
        onHold={holdAndClear}
        canReturn={isAdmin && !editingSale}
        onReturn={() => setShowReturn(true)}
      />

      <div style={styles.middle}>
        {inSale ? (
          <>
            <div style={styles.left}>
              <Card padding={theme.spacing.mdl} style={styles.entry}>
                {renderEntry()}
                <InlineMessage tone="error">{finalizeError}</InlineMessage>
              </Card>
              <CartList
                lines={cartLines}
                stockIssues={stockIssues}
                selectedIndex={stage === 'cart-edit' ? cartHighlight : -1}
                editingIndex={editingLineIndex}
                editingValue={editingQtyValue}
                onEditingChange={setEditingQtyValue}
                editInputRef={editQtyInputRef}
                editingFocValue={editingFocValue}
                onEditingFocChange={setEditingFocValue}
                editFocInputRef={editFocInputRef}
                editingError={editingQtyStockError}
                isAdmin={isAdmin}
                canRemove={stage === 'item-search' || stage === 'cart-edit'}
                active={stage === 'cart-edit'}
                actions={cartActions}
              />
            </div>
            <SummaryCard
              customer={customer}
              customerNote={customerNote}
              itemCount={cartLines.length}
              subtotal={subtotal}
              discountAmount={discountAmount}
              total={totalAmount}
              stage={stage}
              printFormat={printFormat}
              paymentMethod={paymentMethod}
              amountReceived={tenderedNumber}
              changeDue={changeDue}
              balanceDue={balanceDue}
              previousBalance={previousBalance}
              newBalance={newBalance}
              editingInvoiceNo={editingSale?.invoiceNo}
            />
          </>
        ) : (
          <Card padding="0" style={styles.idle}>
            {stage === 'idle' ? (
              <IdlePanel
                draftAvailable={draftAvailable}
                draftItemCount={draftItemCount}
                onStart={startSale}
                onResume={resumeDraft}
                onStartNew={discardDraftAndStart}
              />
            ) : (
              <EmptyState icon={ShoppingCart} color="green" title="Sale complete" style={{ margin: 'auto' }} />
            )}
          </Card>
        )}
      </div>

      {recentlyRemoved && (
        <UndoPill
          label={`${recentlyRemoved.line.productName} (${recentlyRemoved.line.variantName !== 'Standard' ? recentlyRemoved.line.variantName : recentlyRemoved.line.baseUnitName})`}
          onUndo={undoRemove}
        />
      )}
      <KeyHints hints={hints} />

      {showRecent && (
        <RecentBillsPanel
          userId={user.id}
          onClose={() => setShowRecent(false)}
          onEdit={editBill}
          onVoided={(invoiceNo) => {
            toast.success(`Bill ${invoiceNo} voided`);
            window.dispatchEvent(new CustomEvent(SALE_COMPLETED_EVENT));
          }}
        />
      )}
      {showReturn && (
        <BillOverlay title="Return items" subtitle="Take back items from a past sale" onRequestClose={() => setShowReturn(false)}>
          <div style={{ padding: theme.spacing.md, overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
            <Returns params={{}} onNavigate={() => setShowReturn(false)} />
          </div>
        </BillOverlay>
      )}
      {showRecall && <HeldBillsPanel held={heldBills} onRecall={recallHeld} onDiscard={discardHeld} onClose={() => setShowRecall(false)} />}

      {showCancelConfirm && <CancelSaleDialog onKeep={dismissCancelConfirm} onConfirm={confirmCancelSale} />}

      {stage === 'confirm' && confirmData && (
        <SaleCompleteSheet
          data={confirmData}
          receiptPreview={receiptPreview}
          onRetry={() => setShowPrintPreview(true)}
          onClose={dismissConfirm}
        />
      )}

      {stage === 'confirm' && confirmData && showPrintPreview && (
        <PrintPreviewModal
          saleId={confirmData.saleId}
          printType={confirmData.printType}
          showDues={confirmData.showDues}
          onPrinted={onPrinted}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.smd,
    fontFamily: theme.font.family,
  },
  middle: { flex: 1, minHeight: 0, display: 'flex', gap: theme.spacing.md },
  left: { flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: theme.spacing.md },
  entry: { flex: '0 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' },
  idle: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
};
