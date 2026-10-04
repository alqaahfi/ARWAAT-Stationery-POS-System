import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HandCoins, PackagePlus, Pencil, ShoppingCart, UserX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Badge, Button, Card, EmptyState, IconButton, Skeleton } from '../../components/ui';
import QuickPaymentModal from '../../components/billing/QuickPaymentModal';
import QuickSaleOverlay from '../../components/billing/QuickSaleOverlay';
import QuickPurchaseOverlay from '../../components/billing/QuickPurchaseOverlay';
import { formatCurrency, formatDateOnly } from '../../utils/format';
import { priceLevelLabel } from '../../utils/priceLevel';
import { TypeBadge } from '../Customers/parts/CustomerListParts';
import { PartyHeader, contactLine } from './PartyHeader';
import { RecentActivityCard } from './RecentActivityCard';
import { RestrictedNotice } from './PartyParts';

const c = theme.colors;

// Customer / Supplier Profile (/customers/profile, /suppliers/profile). The
// landing page when a list row is clicked: who they are, what they owe, the
// latest ledger activity and a few totals — with New Sale / New Purchase and
// Payment right in the header. A small pencil button opens the edit form.
export default function PartyProfile({ party, partyId, onNavigate }) {
  const { user } = useAuth();
  const isCustomer = party === 'customer';
  const api = isCustomer ? window.api.customers : window.api.suppliers;
  const [record, setRecord] = useState(null);
  const [ledger, setLedger] = useState({ loading: true, error: false, data: null });
  const [missing, setMissing] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  const loadLedger = useCallback(async () => {
    setLedger((l) => ({ ...l, loading: true, error: false }));
    try {
      const res = await api.getLedger({ id: partyId });
      setLedger({ loading: false, error: !res?.success, data: res?.success ? res : null });
    } catch {
      setLedger({ loading: false, error: true, data: null });
    }
  }, [api, partyId]);

  useEffect(() => {
    let cancelled = false;
    api
      .getById({ id: partyId })
      .then((r) => {
        if (cancelled) return;
        if (!r) setMissing(true);
        else setRecord(r);
      })
      .catch(() => !cancelled && setMissing(true));
    loadLedger();
    return () => {
      cancelled = true;
    };
  }, [api, partyId, loadLedger]);

  const stats = useMemo(() => {
    const rows = ledger.data?.transactions || [];
    const bills = rows.filter((r) => r.type === (isCustomer ? 'sale' : 'purchase'));
    const total = bills.reduce((s, r) => s + (Number(r.debit) || 0), 0);
    const paid = rows.filter((r) => r.type === 'payment').reduce((s, r) => s + (Number(r.credit) || 0), 0);
    const last = bills.length ? bills[bills.length - 1].date : null;
    return { count: bills.length, total, paid, average: bills.length ? total / bills.length : 0, last };
  }, [ledger.data, isCustomer]);

  if (user.role !== 'admin') return <RestrictedNotice />;

  const listRoute = isCustomer ? '/customers' : '/suppliers';
  if (missing) {
    return (
      <Card style={{ maxWidth: '560px', margin: '0 auto' }}>
        <EmptyState
          icon={UserX}
          color="red"
          title={`We couldn't open this ${party}`}
          message="They may have been removed on another computer."
          action={<Button onClick={() => onNavigate(listRoute)}>{`Back to ${isCustomer ? 'customers' : 'suppliers'}`}</Button>}
        />
      </Card>
    );
  }
  if (!record) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
        <Skeleton height="96px" />
        <Skeleton lines={5} />
      </div>
    );
  }

  const balance = ledger.data?.balance;
  const ledgerRoute = isCustomer ? '/ledgers/customers' : '/ledgers/suppliers';
  const badges = isCustomer ? (
    <>
      <TypeBadge type={record.customer_type} />
      {record.tier && <Badge>{priceLevelLabel(record.tier)}</Badge>}
      {!record.is_active && <Badge>{glossary.inactive}</Badge>}
    </>
  ) : !record.is_active ? (
    <Badge>{glossary.inactive}</Badge>
  ) : null;

  const details = isCustomer
    ? [
        ['Phone', record.phone],
        ['Mobile', record.mobile],
        ['Email', record.email],
        ['Address', record.address],
        ['Credit limit', Number(record.credit_limit) > 0 ? formatCurrency(record.credit_limit) : null],
        ['Joined', record.joining_date ? formatDateOnly(record.joining_date) : null],
        ['Starting balance', formatCurrency(record.opening_balance)],
      ]
    : [
        ['Contact person', record.contact_person],
        ['Phone', record.phone],
        ['Mobile', record.mobile],
        ['Email', record.email],
        ['Address', record.address],
        ['Joined', record.joining_date ? formatDateOnly(record.joining_date) : null],
        ['Starting balance', formatCurrency(record.opening_balance)],
      ];

  const tiles = isCustomer
    ? [
        ['Total sales', formatCurrency(stats.total), `${stats.count} bill${stats.count === 1 ? '' : 's'}`],
        ['Payments received', formatCurrency(stats.paid)],
        ['Average bill', formatCurrency(stats.average)],
        ['Last sale', stats.last ? formatDateOnly(stats.last) : 'None yet'],
      ]
    : [
        ['Total purchased', formatCurrency(stats.total), `${stats.count} purchase${stats.count === 1 ? '' : 's'}`],
        ['Payments made', formatCurrency(stats.paid)],
        ['Average purchase', formatCurrency(stats.average)],
        ['Last purchase', stats.last ? formatDateOnly(stats.last) : 'None yet'],
      ];

  return (
    <div style={{ paddingBottom: theme.spacing.xxl, display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <PartyHeader
        name={record.name}
        party={party}
        balance={balance}
        badges={badges}
        contact={isCustomer ? contactLine(record.phone, record.mobile, record.address) : contactLine(record.contact_person, record.phone, record.mobile, record.address)}
        actions={
          <>
            <IconButton icon={Pencil} label={isCustomer ? 'Edit customer' : 'Edit supplier'} onClick={() => onNavigate(`${listRoute}/edit`, { id: partyId })} style={{ backgroundColor: c.fill }} />
            <Button variant="secondary" icon={HandCoins} onClick={() => setPaymentOpen(true)}>
              {glossary.payment}
            </Button>
            <Button icon={isCustomer ? ShoppingCart : PackagePlus} onClick={() => setBillOpen(true)}>
              {isCustomer ? glossary.newSale : glossary.newPurchase}
            </Button>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: theme.spacing.md }}>
        {tiles.map(([label, value, sub]) => (
          <Card key={label} padding={theme.spacing.md}>
            <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{label}</div>
            <div style={{ ...theme.type.title2, ...theme.font.numeric, color: c.label, marginTop: '2px' }}>{ledger.loading ? '…' : value}</div>
            {sub && !ledger.loading && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{sub}</div>}
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md, alignItems: 'flex-start' }}>
        <div style={{ flex: '2 1 420px', minWidth: 0 }}>
          <RecentActivityCard
            rows={ledger.data?.transactions}
            loading={ledger.loading}
            error={ledger.error}
            onRetry={loadLedger}
            onSeeAll={() => onNavigate(ledgerRoute, { id: partyId, name: record.name })}
          />
        </div>
        <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          <Card padding="0" style={{ overflow: 'hidden' }}>
            <h2 style={{ ...theme.type.headline, color: c.label, margin: 0, padding: `14px ${theme.spacing.md} 6px` }}>Details</h2>
            <dl style={{ margin: 0 }}>
              {details
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, padding: `8px ${theme.spacing.md}`, borderTop: `1px solid ${c.separator}` }}>
                    <dt style={{ ...theme.type.subhead, color: c.labelSecondary }}>{k}</dt>
                    <dd style={{ ...theme.type.subhead, color: c.label, margin: 0, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</dd>
                  </div>
                ))}
            </dl>
          </Card>
          {record.notes && (
            <Card padding={theme.spacing.md}>
              <div style={{ ...theme.type.footnote, fontWeight: theme.font.weightSemibold, textTransform: 'uppercase', letterSpacing: '0.04em', color: c.labelSecondary }}>Notes</div>
              <div style={{ ...theme.type.body, color: c.label, marginTop: '4px', whiteSpace: 'pre-wrap' }}>{record.notes}</div>
            </Card>
          )}
        </div>
      </div>

      <QuickPaymentModal
        open={paymentOpen}
        party={party}
        partyId={partyId}
        partyName={record.name}
        balance={balance}
        onClose={() => setPaymentOpen(false)}
        onSaved={loadLedger}
      />
      {isCustomer ? (
        <QuickSaleOverlay open={billOpen} customerId={partyId} onSaved={loadLedger} onClose={() => setBillOpen(false)} />
      ) : (
        <QuickPurchaseOverlay open={billOpen} supplierId={partyId} onSaved={loadLedger} onClose={() => setBillOpen(false)} />
      )}
    </div>
  );
}
