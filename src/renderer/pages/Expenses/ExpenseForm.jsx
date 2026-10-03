import React, { useEffect, useRef, useState } from 'react';
import { SearchX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import glossary from '../../config/glossary';
import { Button, Card, EmptyState, useConfirm, useToast } from '../../components/ui';
import { FormSkeleton } from '../Parties/PartyParts';
import { StickyActions } from '../Products/form/StickyActions';
import { BasicsCard, LockedRepeatsCard, RepeatsCard, pageColumn, pageWrap } from './parts/ExpenseFormParts';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function focusField(id) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
  });
}

// Route: /expenses/new (no expenseId) and /expenses/edit (expenseId from the
// Expenses list) — same form either way. Recurrence can only be chosen when
// creating: an existing occurrence's date/amount/payee can be corrected, but
// its recurring series is fixed once started (it can only be stopped).
export default function ExpenseForm({ expenseId, onDone, onCancel }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [recurrence, setRecurrence] = useState('one_time');
  const [recurringId, setRecurringId] = useState(null);
  const [stopped, setStopped] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!expenseId);
  const [notFound, setNotFound] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!expenseId) return;
    window.api.expenses
      .getById({ id: expenseId })
      .then((row) => {
        if (!row) {
          setNotFound(true);
          return;
        }
        setDescription(row.description);
        setAmount(String(row.amount));
        setPayee(row.payee || '');
        setExpenseDate((row.expense_date || '').slice(0, 10) || todayIso());
        setRecurrence(row.recurrence || 'one_time');
        setRecurringId(row.recurring_expense_id || null);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [expenseId]);

  function validate() {
    const next = {};
    const amt = Number(amount);
    if (!amt || amt <= 0) next.amount = 'Enter an amount greater than zero.';
    if (!description.trim()) next.description = 'Description is required.';
    setErrors(next);
    if (next.amount) focusField('expense-amount');
    else if (next.description) focusField('expense-description');
    return !next.amount && !next.description;
  }

  async function handleSave() {
    if (savingRef.current) return;
    if (!validate()) {
      toast.error('Please check the highlighted fields');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        description: description.trim(),
        amount: Number(amount),
        payee: payee.trim() || null,
        expenseDate,
      };
      const res = expenseId
        ? await window.api.expenses.update({ id: expenseId, ...payload })
        : await window.api.expenses.create({ ...payload, recurrence, paidBy: user.id });

      if (!res.success) {
        const reason = res.reason || 'Could not save expense.';
        if (/description/i.test(reason)) {
          setErrors({ description: reason });
          focusField('expense-description');
        } else if (/amount/i.test(reason)) {
          setErrors({ amount: reason });
          focusField('expense-amount');
        }
        toast.error(reason);
        return;
      }
      toast.success('Expense saved');
      onDone();
    } catch {
      toast.error('Could not save expense. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleStopRepeating() {
    const ok = await confirm({
      title: 'Stop repeating this expense?',
      message: 'Expenses already added will stay. No new ones will be added.',
      confirmLabel: glossary.stopRepeating,
      destructive: true,
    });
    if (!ok) return;
    setStopping(true);
    try {
      const res = await window.api.expenses.stopRecurrence({ id: expenseId });
      if (!res.success) {
        toast.error(res.reason || 'Could not stop repeating.');
        return;
      }
      setStopped(true);
      toast.success('This expense no longer repeats');
    } catch {
      toast.error('Could not stop repeating.');
    } finally {
      setStopping(false);
    }
  }

  if (loading) return <FormSkeleton />;

  if (notFound) {
    return (
      <Card padding="0" style={{ maxWidth: '560px', margin: '0 auto' }}>
        <EmptyState
          icon={SearchX}
          title="This expense couldn't be found"
          message="It may have been deleted."
          action={<Button onClick={onCancel}>Back to expenses</Button>}
          style={{ padding: '48px 24px' }}
        />
      </Card>
    );
  }

  const clearError = (key) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined }));

  return (
    <div style={pageWrap}>
      <div style={pageColumn}>
        <BasicsCard
          amount={amount}
          onAmount={(v) => {
            setAmount(v);
            clearError('amount');
          }}
          amountError={errors.amount}
          expenseDate={expenseDate}
          onDate={setExpenseDate}
          payee={payee}
          onPayee={setPayee}
          description={description}
          onDescription={(v) => {
            setDescription(v);
            clearError('description');
          }}
          descriptionError={errors.description}
          isEdit={!!expenseId}
          repeating={!expenseId && recurrence !== 'one_time'}
        />
        {expenseId ? (
          <LockedRepeatsCard recurrence={recurrence} canStop={!!recurringId} stopped={stopped} stopping={stopping} onStop={handleStopRepeating} />
        ) : (
          <RepeatsCard recurrence={recurrence} onRecurrence={setRecurrence} />
        )}
      </div>
      <StickyActions onCancel={onCancel} onSave={handleSave} saving={saving} saveLabel={expenseId ? 'Save changes' : 'Save expense'} />
    </div>
  );
}
