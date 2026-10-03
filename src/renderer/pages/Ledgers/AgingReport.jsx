import React, { useEffect, useMemo, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Card, DataTable, EmptyState } from '../../components/ui';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { PageIntro, TableCard, ledgerPage } from './parts/LedgerParts';
import { BUCKETS, BucketCards, agingColumns } from './parts/AgingParts';
import { openAccount } from './parts/ledgerUtils';

// Route: /ledgers/aging. Customers only. The handler ages each unpaid sale on
// its own (its stored unpaid amount), without matching later payments to
// specific sales — the caveat under the intro says so in plain words.
export default function AgingReport({ onNavigate }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
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
      setRows((await window.api.ledgers.getAgingReport()) || []);
    } catch {
      setError(true);
    }
    setLoading(false);
  }

  const totals = useMemo(() => {
    const out = {};
    for (const b of BUCKETS) out[b.key] = rows.reduce((t, r) => t + (Number(r[b.key]) || 0), 0);
    return out;
  }, [rows]);

  if (user.role !== 'admin') return <RestrictedNotice />;

  return (
    <div style={ledgerPage}>
      <PageIntro note="Each unpaid sale is counted from its own date. Payments aren't matched to specific sales, so treat this as a guide.">
        Customers who owe you money, grouped by how long the oldest unpaid sale has been waiting.
      </PageIntro>

      {error ? (
        <Card>
          <LoadError message="Overdue payments couldn't be loaded." onRetry={load} />
        </Card>
      ) : (
        <>
          <BucketCards totals={totals} loading={loading} />
          <TableCard>
            <DataTable
              columns={agingColumns}
              rows={rows}
              rowKey="customerId"
              loading={loading}
              onRowClick={(r) => openAccount(onNavigate, 'customer', r.customerId, r.customerName)}
              emptyState={<EmptyState icon={CircleCheck} color="green" title="Nobody owes you money right now" />}
            />
          </TableCard>
        </>
      )}
    </div>
  );
}
