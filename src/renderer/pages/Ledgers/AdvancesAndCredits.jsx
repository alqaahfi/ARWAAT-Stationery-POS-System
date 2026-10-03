import React, { useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Badge, Card, DataTable, EmptyState } from '../../components/ui';
import { formatCurrency, formatDateOnly } from '../../utils/format';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { Footnote, PageIntro, PartyCell, TableCard, ledgerPage } from './parts/LedgerParts';
import { openAccount } from './parts/ledgerUtils';

// Route: /ledgers/advances. Every customer and supplier with a negative
// balance (paid ahead), largest first as the handler returns them.
export default function AdvancesAndCredits({ onNavigate }) {
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
      setRows((await window.api.ledgers.getAdvances()) || []);
    } catch {
      setError(true);
    }
    setLoading(false);
  }

  if (user.role !== 'admin') return <RestrictedNotice />;

  const customers = rows.filter((r) => r.partyType === 'customer');
  const suppliers = rows.filter((r) => r.partyType === 'supplier');
  const sum = (list) => list.reduce((t, r) => t + (Number(r.advanceAmount) || 0), 0);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const summary = [
    customers.length && `${plural(customers.length, 'customer')} · ${formatCurrency(sum(customers))} held in advance`,
    suppliers.length && `${plural(suppliers.length, 'supplier')} · ${formatCurrency(sum(suppliers))} paid ahead`,
  ]
    .filter(Boolean)
    .join('   ·   ');

  const columns = [
    { key: 'party', label: 'Party', render: (r) => <PartyCell name={r.partyName} /> },
    {
      key: 'type',
      label: 'Type',
      render: (r) => (r.partyType === 'supplier' ? <Badge tone="orange">Supplier</Badge> : <Badge tone="blue">Customer</Badge>),
    },
    {
      key: 'advance',
      label: 'Advance',
      numeric: true,
      render: (r) => <span style={{ color: theme.colors.greenText, fontWeight: theme.font.weightSemibold }}>{formatCurrency(r.advanceAmount)}</span>,
    },
  ];
  if (rows.some((r) => r.lastActivity)) {
    columns.push({ key: 'last', label: 'Last activity', render: (r) => formatDateOnly(r.lastActivity) });
  }

  return (
    <div style={ledgerPage}>
      <PageIntro>Customers who've paid you ahead of time, and suppliers you've paid ahead.</PageIntro>

      {error ? (
        <Card>
          <LoadError message="The advance payments couldn't be loaded." onRetry={load} />
        </Card>
      ) : (
        <>
          {!loading && summary && <Footnote>{summary}</Footnote>}
          <TableCard>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => `${r.partyType}-${r.partyId}`}
              loading={loading}
              onRowClick={(r) => openAccount(onNavigate, r.partyType, r.partyId, r.partyName)}
              emptyState={<EmptyState icon={CircleCheck} color="green" title="No advance payments" message="Nobody has paid ahead right now." />}
            />
          </TableCard>
        </>
      )}
    </div>
  );
}
