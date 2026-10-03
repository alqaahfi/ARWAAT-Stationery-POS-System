import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Button, Card, useConfirm, useToast } from '../../components/ui';
import { formatCurrency } from '../../utils/format';
import PartyPicker from '../Ledgers/parts/PartyPicker';
import PaymentFormFields from './parts/PaymentFormFields';
import { Intro, NoAccess, PaymentSuccess, SelectedCustomerCard, column } from './parts/ReceivePaymentParts';

// Deliberately minimal — this is NOT the full ledger. Only enough context to
// take a payment: name, type, phone, current balance, all from the
// restricted customers:search-minimal handler so cashiers never see more.
// params { id, name } (from a customer profile) starts at the payment step.
export default function RecordPayment({ params }) {
  const { user, hasPermission } = useAuth();
  const canRecord = hasPermission('record_payment');
  const toast = useToast();
  const confirm = useConfirm();

  const [selected, setSelected] = useState(() => (params?.id ? { id: params.id, name: params.name || 'Customer' } : null));
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // { name, amount, newBalance, estimated }
  const savingRef = useRef(false);
  const selectedIdRef = useRef(selected?.id);
  selectedIdRef.current = selected?.id;

  // Preselected customer: fetch the balance through the same minimal search,
  // matching on id. If it can't be found the payment still works, just
  // without the balance preview.
  useEffect(() => {
    if (!canRecord || !params?.id || !params?.name) return;
    let cancelled = false;
    window.api.customers
      .searchMinimal({ search: params.name })
      .then((rows) => {
        const match = (rows || []).find((r) => String(r.id) === String(params.id));
        if (!cancelled && match && String(selectedIdRef.current) === String(match.id)) setSelected(match);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canRecord, params?.id, params?.name]);

  function selectCustomer(c) {
    setSelected(c);
    setError('');
    setDone(null);
  }

  function resetForNext() {
    setSelected(null);
    setAmount('');
    setPaymentMethod('cash');
    setNote('');
    setError('');
    setDone(null);
  }

  function changeCustomer() {
    if (savingRef.current) return;
    setSelected(null);
    setError('');
  }

  async function handleSave() {
    if (savingRef.current) return;
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError('Enter an amount greater than zero.');

    const owed = Number(selected.balance_owed);
    if (owed > 0 && amt > owed + 0.01) {
      const proceed = await confirm({
        title: 'This is more than they owe',
        message: `They'll be shown as having paid ${formatCurrency(amt - owed)} in advance. Record it anyway?`,
        confirmLabel: glossary.recordPayment,
        cancelLabel: 'Go back',
      });
      if (!proceed) return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const res = await window.api.payments.createStandalone({
        customerId: selected.id,
        amount: amt,
        paymentMethod,
        note: note.trim() || null,
        receivedBy: user.id,
      });

      if (!res.success) {
        const reason = res.reason || 'Could not record payment.';
        setError(reason);
        toast.error(reason);
        return;
      }

      const hasOld = selected.balance_owed !== undefined && selected.balance_owed !== null;
      const known = res.newBalance !== undefined && res.newBalance !== null;
      setDone({
        name: selected.name,
        amount: amt,
        newBalance: known ? res.newBalance : hasOld ? owed - amt : null,
        estimated: !known,
      });
    } catch {
      setError('Could not record payment. Please try again.');
      toast.error('Could not record payment. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!canRecord) return <NoAccess />;

  if (done) {
    return (
      <div style={column}>
        <PaymentSuccess {...done} onNext={resetForNext} />
      </div>
    );
  }

  if (!selected) {
    return (
      <div style={column}>
        <Intro />
        <PartyPicker
          party="customer"
          onPick={selectCustomer}
          showType
          idleTitle="Who is paying?"
          idleMessage="Type part of the customer's name or phone number."
        />
      </div>
    );
  }

  return (
    <div
      style={column}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
          e.preventDefault();
          changeCustomer();
        }
      }}
    >
      <Intro />
      <SelectedCustomerCard customer={selected} onChange={changeCustomer} disabled={saving} />
      <Card title="Payment">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <PaymentFormFields
            amount={amount}
            onAmountChange={setAmount}
            method={paymentMethod}
            onMethodChange={setPaymentMethod}
            note={note}
            onNoteChange={setNote}
            error={error}
            balance={selected.balance_owed}
          />
          <Button type="submit" size="lg" fullWidth loading={saving} style={{ marginTop: theme.spacing.lg }}>
            {glossary.recordPayment}
          </Button>
        </form>
      </Card>
    </div>
  );
}
