import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../components/ui';
import { formatCurrency } from '../../utils/format';
import { contactLine } from '../Parties/PartyHeader';
import { RestrictedNotice } from '../Parties/PartyParts';
import { AccountView, PaymentModal } from './parts/AccountView';
import PaymentFormFields from '../Payments/parts/PaymentFormFields';
import PaymentDoneSheet from '../Payments/parts/PaymentDoneSheet';

// Mounted at /ledgers/suppliers, with or without a supplierId param — no id
// is picker mode (reached from the nav item), an id from the Supplier list,
// profile or search is preselected mode. "Choose another supplier" goes back
// to the picker without navigating away.
export default function SupplierLedger({ supplierId }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [selectedId, setSelectedId] = useState(supplierId || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadRef = useRef(0);

  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [payError, setPayError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [done, setDone] = useState(null); // { paymentId, amount }

  // A fresh row click passes a new supplierId prop even while this component
  // stays mounted — keep the notion of "selected" in sync with it.
  useEffect(() => {
    setSelectedId(supplierId || null);
  }, [supplierId]);

  useEffect(() => {
    if (!selectedId || user.role !== 'admin') {
      setData(null);
      return;
    }
    load(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, user.role]);

  // quiet: refresh after a payment without blanking the page.
  async function load(id, { quiet = false } = {}) {
    const req = ++loadRef.current;
    if (quiet) setRefreshing(true);
    else {
      setLoading(true);
      setData(null);
    }
    setError('');
    try {
      const res = await window.api.suppliers.getLedger({ id });
      if (req !== loadRef.current) return;
      if (res?.success) setData(res);
      else if (quiet) toast.error("The balance couldn't be refreshed.");
      else setError(res?.reason || "This supplier's account couldn't be loaded.");
    } catch {
      if (req !== loadRef.current) return;
      if (quiet) toast.error("The balance couldn't be refreshed.");
      else setError("This supplier's account couldn't be loaded.");
    } finally {
      if (req === loadRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  function openPayment() {
    setAmount('');
    setMethod('cash');
    setNote('');
    setPayError('');
    setPayOpen(true);
  }

  async function handleSave(e) {
    e?.preventDefault();
    if (savingRef.current || !data) return;
    setPayError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setPayError('Enter an amount greater than zero.');
      return;
    }

    const balance = data.balance;
    if (amt > balance + 0.01 && balance > 0) {
      const proceed = await confirm({
        title: 'This is more than you owe',
        message: `They'll be shown as having been paid ${formatCurrency(amt - balance)} in advance. Record it anyway?`,
        confirmLabel: 'Record payment',
        cancelLabel: 'Go back',
      });
      if (!proceed) return;
    }

    savingRef.current = true;
    setSaving(true);
    let res;
    try {
      res = await window.api.payments.createSupplierPayment({
        supplierId: data.supplier.id,
        amount: amt,
        paymentMethod: method,
        note: note.trim() || null,
        receivedBy: user.id,
        requestingUserId: user.id,
      });
    } catch {
      res = null;
    }
    savingRef.current = false;
    setSaving(false);

    if (!res?.success) {
      setPayError(res?.reason || "The payment couldn't be saved. Please try again.");
      return;
    }
    setPayOpen(false);
    toast.success('Payment recorded');
    setDone({ paymentId: res.paymentId, amount: amt });
    load(data.supplier.id, { quiet: true });
  }

  const view = useMemo(
    () =>
      data && {
        balance: data.balance,
        transactions: data.transactions,
        openingBalance: data.supplier.opening_balance,
        openingDate: data.supplier.created_at,
      },
    [data]
  );

  if (user.role !== 'admin') return <RestrictedNotice />;

  const supplier = data?.supplier;

  return (
    <>
      <AccountView
        party="supplier"
        picking={!selectedId}
        onPick={(row) => setSelectedId(row.id)}
        loading={loading}
        error={error}
        onRetry={() => load(selectedId)}
        data={view}
        name={supplier?.name}
        contact={supplier && contactLine(supplier.contact_person, supplier.phone, supplier.address)}
        onPay={openPayment}
        onChooseAnother={() => setSelectedId(null)}
      />

      <PaymentModal
        open={payOpen && !!supplier}
        title={supplier ? `Pay ${supplier.name}` : ''}
        saving={saving}
        onSubmit={handleSave}
        onClose={() => setPayOpen(false)}
      >
        <PaymentFormFields
          amount={amount}
          onAmountChange={setAmount}
          method={method}
          onMethodChange={setMethod}
          note={note}
          onNoteChange={setNote}
          error={payError}
          balance={data?.balance}
          party="supplier"
        />
      </PaymentModal>

      <PaymentDoneSheet
        key={done?.paymentId}
        open={!!done}
        amount={done?.amount}
        balance={data?.balance}
        balanceLoading={refreshing}
        party="supplier"
        onPrint={(format) => window.api.printing.printPaymentReceipt({ paymentId: done.paymentId, format })}
        onClose={() => setDone(null)}
      />
    </>
  );
}
