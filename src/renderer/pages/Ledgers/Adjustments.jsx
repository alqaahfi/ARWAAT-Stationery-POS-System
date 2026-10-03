import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import glossary from '../../config/glossary';
import { Button, Card, DataTable, useConfirm, useToast } from '../../components/ui';
import { formatCurrency } from '../../utils/format';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { Footnote, PageIntro, TableCard, ledgerPage } from './parts/LedgerParts';
import { CorrectionModal, CorrectionsEmpty, correctionColumns } from './parts/CorrectionParts';

const EMPTY_FORM = { partyType: 'customer', party: null, direction: 'more', amount: '', reason: '' };

// Route: /ledgers/adjustments. Manual corrections to a customer/supplier
// balance — e.g. writing off a bad debt, or fixing a wrong entry. Never allow
// a blank reason (it's the audit trail), and never edit or delete one.
export default function Adjustments() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (user.role !== 'admin') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      setRows((await window.api.ledgers.listAdjustments()) || []);
    } catch {
      setError(true);
    }
    setLoading(false);
  }

  function openForm() {
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function update(changes) {
    setForm((f) => ({ ...f, ...changes }));
  }

  const amountValue = Number(form.amount);
  // The exact signed value the handler takes: positive raises the balance,
  // negative lowers it.
  const signedAmount = amountValue > 0 ? (form.direction === 'more' ? amountValue : -amountValue) : 0;
  const currentBalance = form.party ? Number(form.party.balance_owed) : NaN;
  const preview =
    form.party && !Number.isNaN(currentBalance) && signedAmount ? { from: currentBalance, to: currentBalance + signedAmount } : null;

  function describeChange() {
    const name = form.party.name;
    const amt = formatCurrency(amountValue);
    const more = form.direction === 'more';
    return form.partyType === 'supplier'
      ? `You'll owe ${name} ${amt} ${more ? 'more' : 'less'}`
      : `${name} will owe you ${amt} ${more ? 'more' : 'less'}`;
  }

  async function handleSave(e) {
    e?.preventDefault();
    if (savingRef.current) return;

    const next = {};
    if (!form.party) next.party = `Choose a ${form.partyType}.`;
    if (!amountValue || amountValue <= 0) next.amount = 'Enter an amount greater than zero.';
    if (!form.reason.trim()) next.reason = 'Write a short reason — it stays with the correction.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const proceed = await confirm({
      title: 'Add this correction?',
      message: `${describeChange()}. Corrections can't be edited or deleted afterwards.`,
      confirmLabel: 'Add correction',
      cancelLabel: 'Go back',
    });
    if (!proceed) return;

    savingRef.current = true;
    setSaving(true);
    let res;
    try {
      res = await window.api.ledgers.createAdjustment({
        partyType: form.partyType,
        partyId: form.party.id,
        amount: signedAmount,
        reason: form.reason.trim(),
        createdBy: user.id,
        requestingUserId: user.id,
      });
    } catch {
      res = null;
    }
    savingRef.current = false;
    setSaving(false);

    if (!res?.success) {
      const message = res?.reason || "The correction couldn't be saved. Please try again.";
      setErrors({ form: message });
      toast.error(message);
      return;
    }
    setFormOpen(false);
    toast.success('Correction added');
    load();
  }

  const hasAddedBy = rows.some((r) => r.created_by_name);
  const columns = useMemo(() => correctionColumns(hasAddedBy), [hasAddedBy]);

  if (user.role !== 'admin') return <RestrictedNotice />;

  return (
    <div style={ledgerPage}>
      <PageIntro
        actions={
          <Button icon={Plus} onClick={openForm}>
            {glossary.addCorrection}
          </Button>
        }
      >
        Fix a customer's or supplier's balance when something was entered wrong, or write off a debt. Corrections are permanent.
      </PageIntro>

      {error ? (
        <Card>
          <LoadError message="The corrections couldn't be loaded." onRetry={load} />
        </Card>
      ) : (
        <>
          {!loading && rows.length > 0 && <Footnote>{`${rows.length} correction${rows.length === 1 ? '' : 's'}`}</Footnote>}
          <TableCard>
            <DataTable columns={columns} rows={rows} loading={loading} emptyState={<CorrectionsEmpty />} />
          </TableCard>
        </>
      )}

      <CorrectionModal
        open={formOpen}
        partyType={form.partyType}
        onPartyType={(partyType) => partyType !== form.partyType && update({ partyType, party: null })}
        party={form.party}
        onPick={(party) => {
          update({ party });
          setErrors((er) => ({ ...er, party: undefined }));
        }}
        onClearParty={() => update({ party: null })}
        direction={form.direction}
        onDirection={(direction) => update({ direction })}
        amount={form.amount}
        onAmount={(amount) => update({ amount })}
        reason={form.reason}
        onReason={(reason) => update({ reason })}
        preview={preview}
        errors={errors}
        saving={saving}
        onSubmit={handleSave}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
}
