import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import CustomerSelector from './components/CustomerSelector';
import ProductSearch from './components/ProductSearch';
import Cart from './components/Cart';
import PaymentPanel from './components/PaymentPanel';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export default function Sale() {
  const { user, hasPermission } = useAuth();
  const isAdmin = user.role === 'admin';
  const canSell = hasPermission('make_sale');

  const [customer, setCustomer] = useState(null);
  const [letterheadId, setLetterheadId] = useState(null);
  const [cartLines, setCartLines] = useState([]);
  const [discountMode, setDiscountMode] = useState('percentage');
  const [discountInput, setDiscountInput] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountCap, setDiscountCap] = useState(null);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    window.api.sales.getCashierDiscountCap({ userId: user.id }).then((res) => setDiscountCap(res.capPercentage));
  }, [user.id]);

  // Re-resolve every non-overridden line's price whenever the customer changes
  // (net-rate / percentage rules key off the customer, retail vs wholesale too).
  useEffect(() => {
    if (cartLines.length === 0) return;
    (async () => {
      const updated = await Promise.all(
        cartLines.map(async (line) => {
          if (line.overridden) return line;
          const res = await window.api.sales.resolvePrice({ productUnitId: line.unitId, customerId: customer?.id || null });
          return { ...line, unitPrice: res.price };
        })
      );
      setCartLines(updated);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  function handleSelectCustomer(c, resolvedLetterheadId) {
    setCustomer(c);
    setLetterheadId(resolvedLetterheadId);
  }

  async function addVariantToCart(variantId) {
    setError('');
    const detail = await window.api.sales.getVariantForCart({ variantId });
    if (!detail || !detail.defaultUnitId) {
      setError('This item has no sale unit configured.');
      return;
    }
    const unitId = detail.defaultUnitId;
    const priceRes = await window.api.sales.resolvePrice({ productUnitId: unitId, customerId: customer?.id || null });

    setCartLines((lines) => {
      const existingIndex = lines.findIndex((l) => l.variantId === detail.variant.id && l.unitId === unitId);
      if (existingIndex >= 0) {
        return lines.map((l, i) => (i === existingIndex ? { ...l, quantity: l.quantity + 1 } : l));
      }
      const unit = detail.units.find((u) => u.id === unitId);
      return [
        ...lines,
        {
          key: `${detail.variant.id}-${unitId}-${Date.now()}`,
          variantId: detail.variant.id,
          variantName: detail.variant.variantName,
          productId: detail.product.id,
          productName: detail.product.name,
          baseUnitName: detail.product.baseUnitName,
          stockQty: detail.variant.stockQty,
          units: detail.units,
          unitId,
          conversionFactor: unit.conversionFactor,
          quantity: 1,
          unitPrice: priceRes.price,
          costPrice: unit.costPrice,
          overridden: false,
        },
      ];
    });
  }

  async function updateLineUnit(key, newUnitId) {
    const line = cartLines.find((l) => l.key === key);
    if (!line) return;
    const unit = line.units.find((u) => u.id === newUnitId);
    const priceRes = await window.api.sales.resolvePrice({ productUnitId: newUnitId, customerId: customer?.id || null });
    setCartLines((lines) =>
      lines.map((l) =>
        l.key === key
          ? { ...l, unitId: newUnitId, conversionFactor: unit.conversionFactor, unitPrice: priceRes.price, costPrice: unit.costPrice, overridden: false }
          : l
      )
    );
  }

  function updateLineQuantity(key, quantity) {
    setCartLines((lines) => lines.map((l) => (l.key === key ? { ...l, quantity: Number(quantity) || 0 } : l)));
  }

  function updateLinePriceOverride(key, price) {
    setCartLines((lines) => lines.map((l) => (l.key === key ? { ...l, unitPrice: Number(price) || 0, overridden: true } : l)));
  }

  function removeLine(key) {
    setCartLines((lines) => lines.filter((l) => l.key !== key));
  }

  function resetSale() {
    setCustomer(null);
    setLetterheadId(null);
    setCartLines([]);
    setDiscountInput(0);
    setPaidAmount(0);
    setPaymentMethod('cash');
    setError('');
  }

  // ---- derived totals ----
  const stockIssues = {};
  for (const line of cartLines) {
    const baseQty = (Number(line.quantity) || 0) * line.conversionFactor;
    if (baseQty > line.stockQty) stockIssues[line.key] = true;
  }
  const hasStockIssue = Object.keys(stockIssues).length > 0;

  const subtotal = cartLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const discountAmount =
    discountMode === 'percentage' ? round2((subtotal * (Number(discountInput) || 0)) / 100) : round2(Number(discountInput) || 0);
  const totalAmount = Math.max(0, round2(subtotal - discountAmount));
  const balance = Math.max(0, round2(totalAmount - (Number(paidAmount) || 0)));
  const paymentStatus = Number(paidAmount) <= 0 ? 'unpaid' : Number(paidAmount) >= totalAmount ? 'paid' : 'partial';

  const discountPercentageEquivalent =
    discountMode === 'percentage' ? Number(discountInput) || 0 : subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  const discountExceedsCap = discountCap !== null && discountPercentageEquivalent > discountCap;

  const saleType = customer ? customer.customer_type : 'retail';
  const disableComplete = cartLines.length === 0 || hasStockIssue || discountExceedsCap || (balance > 0 && !customer);

  async function handleCompleteSale() {
    setError('');
    if (cartLines.length === 0) return setError('Cart is empty.');
    if (hasStockIssue) return setError('Fix stock issues before completing the sale.');
    if (discountExceedsCap) return setError(`Discount exceeds your limit of ${discountCap}%.`);
    if (balance > 0 && !customer) return setError('Select a customer to sell on credit — walk-in sales must be paid in full.');

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
      paidAmount: Number(paidAmount) || 0,
      paymentMethod,
    };

    const res = await window.api.sales.create(payload);
    setCompleting(false);

    if (!res.success) {
      setError(res.reason || 'Could not complete sale.');
      return;
    }

    await window.api.printing.printSale({ saleId: res.saleId, printType: saleType === 'wholesale' ? 'wholesale-a4' : 'retail-thermal' });
    setSuccessMessage(`Sale completed — Invoice ${res.invoiceNo}. Receipt would print here — printing module not yet implemented.`);
    resetSale();
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
      {successMessage && (
        <div style={styles.successBanner}>
          {successMessage}
          <button style={styles.dismissBtn} onClick={() => setSuccessMessage('')}>
            ✕
          </button>
        </div>
      )}

      <div style={styles.columns}>
        <div style={styles.leftCol}>
          <ProductSearch onAddVariant={addVariantToCart} />
        </div>

        <div style={styles.centerCol}>
          <CustomerSelector customer={customer} onSelectCustomer={handleSelectCustomer} />
          <div style={{ flex: 1, minHeight: 0, marginTop: '12px' }}>
            <Cart
              lines={cartLines}
              stockIssues={stockIssues}
              isAdmin={isAdmin}
              onUpdateUnit={updateLineUnit}
              onUpdateQuantity={updateLineQuantity}
              onUpdatePriceOverride={updateLinePriceOverride}
              onRemove={removeLine}
            />
          </div>
        </div>

        <div style={styles.rightCol}>
          <PaymentPanel
            subtotal={subtotal}
            discountMode={discountMode}
            discountInput={discountInput}
            onDiscountModeChange={setDiscountMode}
            onDiscountInputChange={setDiscountInput}
            discountCap={discountCap}
            discountExceedsCap={discountExceedsCap}
            discountAmount={discountAmount}
            totalAmount={totalAmount}
            paidAmount={paidAmount}
            onPaidAmountChange={setPaidAmount}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            balanceDue={balance}
            paymentStatus={paymentStatus}
            customer={customer}
            onComplete={handleCompleteSale}
            completing={completing}
            disableComplete={disableComplete}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', fontFamily: theme.font.family },
  successBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.successBackground,
    color: theme.colors.success,
    border: `1px solid ${theme.colors.success}`,
    padding: '10px 16px',
    borderRadius: theme.radius.md,
    marginBottom: '12px',
    fontSize: theme.font.sizeSm,
  },
  dismissBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: theme.font.sizeBase, color: theme.colors.success },
  columns: { display: 'flex', gap: '14px', flex: 1, minHeight: 0 },
  leftCol: { flex: '1.1', minWidth: 0 },
  centerCol: { flex: '1.4', minWidth: 0, display: 'flex', flexDirection: 'column' },
  rightCol: { flex: '1', minWidth: '280px', maxWidth: '340px' },
  accessDenied: { padding: '40px', color: theme.colors.textPrimary, fontFamily: theme.font.family },
};
