import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { SegmentedControl, useToast } from '../ui';
import { PaymentModal } from '../../pages/Ledgers/parts/AccountView';
import PaymentFormFields from '../../pages/Payments/parts/PaymentFormFields';
import PaymentDoneSheet from '../../pages/Payments/parts/PaymentDoneSheet';
import { formatCurrency } from '../../utils/format';

const c = theme.colors;

const ADVANCE_NOTE = 'Advance payment';

// Records a payment right on the profile page. The person picks whether it
// clears money that is owed or is paid ahead (an advance). When it saves, the
// modal closes, `onSaved` lets the page refresh its balance, and the usual
// "print a receipt?" sheet follows.
//
//   party     'customer' (money comes in) | 'supplier' (money goes out)
//   balance   what the account stands at now (positive = owed)
// Keep this mounted and drive it with `open`, so the receipt sheet can outlive the form.
export default function QuickPaymentModal({ open, party, partyId, partyName, balance, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const isSupplier = party === 'supplier';
  const owed = Number(balance) > 0 ? Number(balance) : 0;

  const [kind, setKind] = useState('owed'); // 'owed' | 'advance'
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // { paymentId, amount, newBalance }
  const savingRef = useRef(false);

  // A fresh form each time it opens: clearing what is owed if anything is, otherwise an advance.
  useEffect(() => {
    if (!open) return;
    const startKind = owed > 0 ? 'owed' : 'advance';
    setKind(startKind);
    setAmount(startKind === 'owed' ? String(owed) : '');
    setMethod('cash');
    setNote('');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function chooseKind(next) {
    setKind(next);
    setError('');
    setAmount(next === 'owed' && owed > 0 ? String(owed) : '');
  }

  const kindOptions = [
    { value: 'owed', label: 'Owed amount', disabled: owed <= 0 },
    { value: 'advance', label: 'Advance payment' },
  ];

  async function handleSave(e) {
    e?.preventDefault();
    if (savingRef.current) return;
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (kind === 'owed' && amt > owed + 0.01) {
      setError(
        `That is more than the ${formatCurrency(owed)} ${isSupplier ? 'you owe' : 'they owe'}. Choose "Advance payment" to record the extra.`
      );
      return;
    }

    const noteText = note.trim();
    const finalNote = kind === 'advance' ? (noteText ? `${ADVANCE_NOTE} — ${noteText}` : ADVANCE_NOTE) : noteText || null;

    savingRef.current = true;
    setSaving(true);
    let res;
    try {
      res = isSupplier
        ? await window.api.payments.createSupplierPayment({
            supplierId: partyId,
            amount: amt,
            paymentMethod: method,
            note: finalNote,
            receivedBy: user.id,
            requestingUserId: user.id,
          })
        : await window.api.payments.createStandalone({
            customerId: partyId,
            amount: amt,
            paymentMethod: method,
            note: finalNote,
            receivedBy: user.id,
          });
    } catch {
      res = null;
    }
    savingRef.current = false;
    setSaving(false);

    if (!res?.success) {
      setError(res?.reason || "The payment couldn't be saved. Please try again.");
      return;
    }
    toast.success('Payment recorded');
    setDone({ paymentId: res.paymentId, amount: amt, newBalance: res.newBalance });
    onSaved?.(res);
    onClose?.();
  }

  return (
    <>
      <PaymentModal
        open={open}
        title={isSupplier ? `Pay ${partyName || 'supplier'}` : `Payment from ${partyName || 'customer'}`}
        saving={saving}
        onSubmit={handleSave}
        onClose={onClose}
      >
        <div style={{ marginBottom: theme.spacing.md }}>
          <div aria-hidden="true" style={{ ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, marginBottom: '6px' }}>
            What is this payment for?
          </div>
          <SegmentedControl
            label="Payment type"
            value={kind}
            onChange={chooseKind}
            fullWidth
            options={kindOptions.filter((o) => !o.disabled || o.value === kind)}
          />
          <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '6px' }}>
            {kind === 'owed'
              ? owed > 0
                ? `Clears what ${isSupplier ? 'you owe' : 'they owe'}: ${formatCurrency(owed)} right now.`
                : 'Nothing is owed right now.'
              : `Paid ahead of time. It sits on the account as credit and is used up by ${isSupplier ? 'your next purchases' : 'their next sales'}.`}
          </div>
        </div>
        <PaymentFormFields
          amount={amount}
          onAmountChange={setAmount}
          method={method}
          onMethodChange={setMethod}
          note={note}
          onNoteChange={setNote}
          error={error}
          balance={balance}
          party={party}
        />
      </PaymentModal>

      <PaymentDoneSheet
        key={done?.paymentId}
        open={!!done}
        amount={done?.amount}
        balance={done?.newBalance}
        party={party}
        onPrint={(format) => window.api.printing.printPaymentReceipt({ paymentId: done.paymentId, format })}
        onClose={() => setDone(null)}
      />
    </>
  );
}
