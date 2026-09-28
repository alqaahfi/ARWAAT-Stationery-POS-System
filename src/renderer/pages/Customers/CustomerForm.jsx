import React, { useCallback, useEffect, useRef, useState } from 'react';
import { UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, EmptyState, useToast } from '../../components/ui';
import { StickyActions } from '../Products/form/StickyActions';
import { RecentActivityCard } from '../Parties/RecentActivityCard';
import { StartingBalanceField } from '../Parties/StartingBalanceField';
import { FormSkeleton, RestrictedNotice, pageColumn, pageWrap } from '../Parties/PartyParts';
import { BasicsCard, CustomerHeader, CustomerMoreOptions, PricingCard } from './parts/CustomerFormParts';

export default function CustomerForm({ customerId, onDone, onCancel, onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();
  const isEdit = !!customerId;

  const [letterheads, setLetterheads] = useState([]);
  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState('retail');
  const [tier, setTier] = useState('');
  const [assignedLetterheadId, setAssignedLetterheadId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);
  const [loadFailed, setLoadFailed] = useState(false);
  // The record as last loaded — drives the header, so it doesn't change while typing.
  const [saved, setSaved] = useState(null);
  const [ledger, setLedger] = useState({ loading: false, error: false, data: null });
  const savingRef = useRef(false);

  useEffect(() => {
    window.api.letterheads
      .list()
      .then((rows) => setLetterheads(rows || []))
      .catch(() => setLetterheads([]));
  }, []);

  // Balance + recent activity come from one ledger call. A failure here never
  // blocks editing.
  const loadLedger = useCallback(async () => {
    if (!customerId) return;
    setLedger((l) => ({ ...l, loading: true, error: false }));
    try {
      const res = await window.api.customers.getLedger({ id: customerId });
      setLedger({ loading: false, error: !res?.success, data: res?.success ? res : null });
    } catch {
      setLedger({ loading: false, error: true, data: null });
    }
  }, [customerId]);

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    window.api.customers
      .getById({ id: customerId })
      .then((c) => {
        if (cancelled) return;
        if (!c) {
          setLoadFailed(true);
          return;
        }
        setName(c.name);
        setCustomerType(c.customer_type);
        setTier(c.tier || '');
        setAssignedLetterheadId(c.assigned_letterhead_id || '');
        setPhone(c.phone || '');
        setAddress(c.address || '');
        setOpeningBalance(c.opening_balance);
        setIsActive(!!c.is_active);
        setSaved({ name: c.name, customerType: c.customer_type, tier: c.tier, phone: c.phone, address: c.address, isActive: !!c.is_active });
        setLoaded(true);
        loadLedger();
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  function focusName() {
    requestAnimationFrame(() => {
      const el = document.getElementById('customer-name');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    });
  }

  async function handleSave() {
    if (savingRef.current) return;
    if (!name.trim()) {
      setNameError('Customer name is required.');
      toast.error('Please check the highlighted fields');
      focusName();
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        customerType,
        tier: tier || null,
        assignedLetterheadId: assignedLetterheadId ? Number(assignedLetterheadId) : null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      };

      const res = isEdit
        ? await window.api.customers.update({ id: customerId, ...payload })
        : await window.api.customers.create({ ...payload, openingBalance: Number(openingBalance) || 0 });

      if (!res.success) {
        if (/name/i.test(res.reason || '')) {
          setNameError(res.reason);
          focusName();
        }
        toast.error(res.reason || 'Could not save customer.');
        return;
      }
      if (isEdit && saved && isActive !== saved.isActive) {
        await window.api.customers.setActive({ id: customerId, isActive: isActive ? 1 : 0 });
      }
      toast.success('Customer saved');
      onDone();
    } catch {
      toast.error('Could not save customer. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (user.role !== 'admin') {
    return <RestrictedNotice />;
  }

  if (loadFailed) {
    return (
      <Card style={{ maxWidth: '560px', margin: '0 auto' }}>
        <EmptyState
          icon={UserX}
          color="red"
          title="We couldn't open this customer"
          message="They may have been removed on another computer."
          action={<Button onClick={onCancel}>Back to customers</Button>}
        />
      </Card>
    );
  }

  if (!loaded) {
    return <FormSkeleton />;
  }

  const openAccount = onNavigate ? () => onNavigate('/ledgers/customers', { id: customerId, name: saved?.name }) : undefined;

  return (
    <div style={pageWrap}>
      <div style={pageColumn}>
        {isEdit && saved && (
          <>
            <CustomerHeader customer={saved} balance={ledger.data?.balance} onOpenAccount={openAccount} />
            <RecentActivityCard
              rows={ledger.data?.transactions}
              loading={ledger.loading}
              error={ledger.error}
              onRetry={loadLedger}
              onSeeAll={openAccount}
            />
          </>
        )}

        <BasicsCard
          name={name}
          onName={(v) => {
            setName(v);
            if (v.trim()) setNameError('');
          }}
          nameError={nameError}
          autoFocus={!isEdit}
          customerType={customerType}
          onCustomerType={setCustomerType}
          phone={phone}
          onPhone={setPhone}
          address={address}
          onAddress={setAddress}
        />

        <PricingCard
          tier={tier}
          onTier={setTier}
          customerType={customerType}
          letterheads={letterheads}
          letterheadId={assignedLetterheadId}
          onLetterheadId={setAssignedLetterheadId}
        />

        <StartingBalanceField party="customer" isEdit={isEdit} value={openingBalance} onChange={setOpeningBalance} id="customer-opening-balance" />

        {isEdit && <CustomerMoreOptions isActive={isActive} onIsActive={setIsActive} />}
      </div>

      <StickyActions onCancel={onCancel} onSave={handleSave} saving={saving} saveLabel={isEdit ? 'Save changes' : 'Save customer'} />
    </div>
  );
}
