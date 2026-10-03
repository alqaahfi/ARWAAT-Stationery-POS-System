import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge, useConfirm, useToast } from '../../components/ui';
import { formatCurrency } from '../../utils/format';
import { priceLevelLabel } from '../../utils/priceLevel';
import { contactLine } from '../Parties/PartyHeader';
import { RestrictedNotice } from '../Parties/PartyParts';
import { TypeBadge } from '../Customers/parts/CustomerListParts';
import { AccountView, PaymentModal } from './parts/AccountView';
import PaymentFormFields from '../Payments/parts/PaymentFormFields';
import PaymentDoneSheet from '../Payments/parts/PaymentDoneSheet';

// Mounted at /ledgers/customers, with or without a customerId param — no id
// is picker mode (reached from the nav item), an id from the Customer list,
// profile or search is preselected mode. "Choose another customer" goes back
// to the picker without navigating away.
export default function CustomerLedger({ customerId }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [selectedId, setSelectedId] = useState(customerId || null);
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

  // A fresh row click passes a new customerId prop even while this component
  // stays mounted — keep the notion of "selected" in sync with it.
  useEffect(() => {
    setSelectedId(customerId || null);
  }, [customerId]);

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
      const res = await window.api.customers.getLedger({ id });
      if (req !== loadRef.current) return;
      if (res?.success) setData(res);
      else if (quiet) toast.error("The balance couldn't be refreshed.");
      else setError(res?.reason || "This customer's account couldn't be loaded.");
    } catch {
      if (req !== loadRef.current) return;
      if (quiet) toast.error("The balance couldn't be refreshed.");
      else setError("This customer's account couldn't be loaded.");
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
        title: 'This is more than they owe',
        message: `They'll be shown as having paid ${formatCurrency(amt - balance)} in advance. Record it anyway?`,
        confirmLabel: 'Record payment',
        cancelLabel: 'Go back',
      });
      if (!proceed) return;
    }

    savingRef.current = true;
    setSaving(true);
    let res;
    try {
      res = await window.api.payments.createStandalone({
        customerId: data.customer.id,
        amount: amt,
        paymentMethod: method,
        note: note.trim() || null,
        receivedBy: user.id,
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
    load(data.customer.id, { quiet: true });
  }

  const view = useMemo(
    () =>
      data && {
        balance: data.balance,
        transactions: data.transactions,
        openingBalance: data.customer.opening_balance,
        openingDate: data.customer.created_at,
      },
    [data]
  );

  if (user.role !== 'admin') return <RestrictedNotice />;

  const customer = data?.customer;

  return (
    <>
      <AccountView
        party="customer"
        picking={!selectedId}
        onPick={(row) => setSelectedId(row.id)}
        loading={loading}
        error={error}
        onRetry={() => load(selectedId)}
        data={view}
        name={customer?.name}
        badges={
          customer && (
            <>
              <TypeBadge type={customer.customer_type} />
              {customer.tier && <Badge>{priceLevelLabel(customer.tier)}</Badge>}
            </>
          )
        }
        contact={customer && contactLine(customer.phone, customer.mobile, customer.address)}
        onPay={openPayment}
        onChooseAnother={() => setSelectedId(null)}
      />

      <PaymentModal
        open={payOpen && !!customer}
        title={customer ? `Receive payment from ${customer.name}` : ''}
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
          party="customer"
        />
      </PaymentModal>

      <PaymentDoneSheet
        key={done?.paymentId}
        open={!!done}
        amount={done?.amount}
        balance={data?.balance}
        balanceLoading={refreshing}
        party="customer"
        onPrint={(format) => window.api.printing.printPaymentReceipt({ paymentId: done.paymentId, format })}
        onClose={() => setDone(null)}
      />
    </>
  );
}
