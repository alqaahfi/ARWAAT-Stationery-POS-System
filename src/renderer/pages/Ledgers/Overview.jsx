import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import glossary from '../../config/glossary';
import appIcons from '../../config/appIcons';
import { Card } from '../../components/ui';
import { formatCurrency } from '../../utils/format';
import StatTile from '../Dashboard/parts/StatTile';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { PageIntro, ledgerPage } from './parts/LedgerParts';
import { SeeOverdueButton, TopPartiesCard, cardGrid, statGrid } from './parts/OverviewParts';
import { openAccount } from './parts/ledgerUtils';

// Route: /ledgers. The Accounts landing page — who owes the shop, who the
// shop owes, and where to go next.
export default function Overview({ onNavigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (user.role !== 'admin') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      setData(await window.api.ledgers.getOverview());
    } catch {
      setError(true);
    }
    setLoading(false);
  }

  if (user.role !== 'admin') return <RestrictedNotice />;

  const money = (key) => formatCurrency(Number(data?.[key]) || 0);
  const hasSupplierAdvance = data && data.totalPrepaidToSuppliers !== undefined;

  return (
    <div style={ledgerPage}>
      <PageIntro>Who owes you, who you owe, and who needs a reminder.</PageIntro>

      {error ? (
        <Card>
          <LoadError message="The account totals couldn't be loaded." onRetry={load} />
        </Card>
      ) : (
        <>
          <div style={statGrid}>
            <StatTile
              {...appIcons.receivePayment}
              label={glossary.customersOweYou}
              value={money('totalReceivable')}
              footnote={glossary.customerAccounts}
              loading={loading}
              onClick={() => onNavigate('/ledgers/customers')}
            />
            <StatTile
              {...appIcons.paySupplier}
              label={glossary.youOweSuppliers}
              value={money('totalPayable')}
              footnote={glossary.supplierAccounts}
              loading={loading}
              onClick={() => onNavigate('/ledgers/suppliers')}
            />
            <StatTile
              {...appIcons.paidInAdvance}
              label={glossary.paidInAdvance}
              value={money('totalAdvancesHeld')}
              footnote="Held for customers"
              loading={loading}
              onClick={() => onNavigate('/ledgers/advances')}
            />
            {(loading || hasSupplierAdvance) && (
              <StatTile
                {...appIcons.suppliers}
                label={glossary.paidAheadToSuppliers}
                value={money('totalPrepaidToSuppliers')}
                footnote="Already paid to suppliers"
                loading={loading}
                onClick={() => onNavigate('/ledgers/advances')}
              />
            )}
          </div>

          <div style={cardGrid}>
            <TopPartiesCard
              title="Customers who owe the most"
              party="customer"
              rows={data?.topCustomers}
              loading={loading}
              emptyText="Nobody owes you anything right now"
              onOpen={(row) => openAccount(onNavigate, 'customer', row.id, row.name)}
              footer={<SeeOverdueButton onClick={() => onNavigate('/ledgers/aging')} />}
            />
            <TopPartiesCard
              title="Suppliers you owe the most"
              party="supplier"
              rows={data?.topSuppliers}
              loading={loading}
              emptyText="You don't owe any supplier right now"
              onOpen={(row) => openAccount(onNavigate, 'supplier', row.id, row.name)}
            />
          </div>
        </>
      )}
    </div>
  );
}
