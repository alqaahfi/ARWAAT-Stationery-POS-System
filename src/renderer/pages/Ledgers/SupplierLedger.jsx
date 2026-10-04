import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { contactLine } from '../Parties/PartyHeader';
import { RestrictedNotice } from '../Parties/PartyParts';
import { AccountView } from './parts/AccountView';
import QuickPaymentModal from '../../components/billing/QuickPaymentModal';

// Mounted at /ledgers/suppliers, with or without a supplierId param — no id
// is picker mode (reached from the nav item), an id from the Supplier list,
// profile or search is preselected mode. "Choose another supplier" goes back
// to the picker without navigating away.
export default function SupplierLedger({ supplierId, onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(supplierId || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadRef = useRef(0);

  const [payOpen, setPayOpen] = useState(false);

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
    setPayOpen(true);
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
        onNavigate={onNavigate}
      />

      <QuickPaymentModal
        open={payOpen && !!supplier}
        party="supplier"
        partyId={supplier?.id}
        partyName={supplier?.name}
        balance={data?.balance}
        onClose={() => setPayOpen(false)}
        onSaved={() => load(supplier.id, { quiet: true })}
      />
    </>
  );
}
