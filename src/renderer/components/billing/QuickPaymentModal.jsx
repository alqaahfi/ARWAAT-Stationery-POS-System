import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { SegmentedControl, useToast } from '../ui';
import { PaymentModal } from '../../pages/Ledgers/parts/AccountView';
import PaymentFormFields from '../../pages/Payments/parts/PaymentFormFields';
import PaymentDoneSheet from '../../pages/Payments/parts/PaymentDoneSheet';

const c = theme.colors;

const ADVANCE_NOTE = 'Advance payment';
const OWED_NOTE = 'Owed amount';

// Records an entry on the account right from the profile / ledger page. The
// first control says what the entry is:
//   Owed amount     the party has to give us (customer) / we have to give them
//                   (supplier) this much more — it ADDS to what is owed. Saved as
//                   a balance correction (no money changes hands).
//   Advance payment money was handed over now (customer gave us / we gave the
//                   supplier) — it reduces what is owed, or sits as credit.
// `onSaved` lets the page refresh its balance; an advance then shows the usual
// "print a receipt?" sheet. Keep this mounted and drive it with `open`.
//
//   party     'customer' | 'supplier'
//   balance   what the account stands at now (positive = owed)
export default function QuickPaymentModal({ open, party, partyId, partyName, balance, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const isSupplier = party === 'supplier';

  const [kind, setKind] = useState('owed'); // 'owed' | 'advance'
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // { paymentId, amount, newBalance }
  const savingRef = useRef(false);

  // A fresh form each time it opens.
  useEffect(() => {
    if (!open) return;
    setKind('owed');
    setAmount('');
    setMethod('cash');
    setNote('');
    setError('');
  }, [open]);

  function chooseKind(next) {
    setKind(next);
    setError('');
  }

  const kindOptions = [
    { value: 'owed', label: 'Owed amount' },
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
    const noteText = note.trim();
    const finalNote = kind === 'advance' ? (noteText ? `${ADVANCE_NOTE} — ${noteText}` : ADVANCE_NOTE) : noteText || null;

    if (kind === 'owed') {
      savingRef.current = true;
      setSaving(true);
      let adj;
      try {
        adj = await window.api.ledgers.createAdjustment({
          partyType: party,
          partyId,
          amount: amt,
          reason: noteText ? `${OWED_NOTE} — ${noteText}` : OWED_NOTE,
          createdBy: user.id,
          requestingUserId: user.id,
        });
      } catch {
        adj = null;
      }
      savingRef.current = false;
      setSaving(false);
      if (!adj?.success) {
        setError(adj?.reason || "The entry couldn't be saved. Please try again.");
        return;
      }
      toast.success('Owed amount added');
      onSaved?.(adj);
      onClose?.();
      return;
    }

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
        title={`Payment · ${partyName || (isSupplier ? 'supplier' : 'customer')}`}
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
            options={kindOptions}
          />
          <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '6px' }}>
            {kind === 'owed'
              ? isSupplier
                ? 'You have to pay the supplier this amount. It is added to what you owe them.'
                : 'The customer has to pay you this amount. It is added to what they owe you.'
              : isSupplier
                ? 'You have given the supplier this amount now. It is taken off what you owe them.'
                : 'The customer has given you this amount now. It is taken off what they owe you.'}
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
          previewSign={kind === 'owed' ? -1 : 1}
          previewLabel={kind === 'owed' ? 'Preview · After adding this:' : 'Preview · After this payment:'}
          hideMethod={kind === 'owed'}
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
