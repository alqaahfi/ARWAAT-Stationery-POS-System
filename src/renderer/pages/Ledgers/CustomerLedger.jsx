import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge, useToast } from '../../components/ui';
import { priceLevelLabel } from '../../utils/priceLevel';
import { contactLine } from '../Parties/PartyHeader';
import { RestrictedNotice } from '../Parties/PartyParts';
import { TypeBadge } from '../Customers/parts/CustomerListParts';
import { AccountView } from './parts/AccountView';
import QuickPaymentModal from '../../components/billing/QuickPaymentModal';

// Mounted at /ledgers/customers, with or without a customerId param — no id
// is picker mode (reached from the nav item), an id from the Customer list,
// profile or search is preselected mode. "Choose another customer" goes back
// to the picker without navigating away.
export default function CustomerLedger({ customerId }) {
  const { user } = useAuth();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(customerId || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadRef = useRef(0);

  const [payOpen, setPayOpen] = useState(false);

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
    setPayOpen(true);
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

      <QuickPaymentModal
        open={payOpen && !!customer}
        party="customer"
        partyId={customer?.id}
        partyName={customer?.name}
        balance={data?.balance}
        onClose={() => setPayOpen(false)}
        onSaved={() => load(customer.id, { quiet: true })}
      />
    </>
  );
}
