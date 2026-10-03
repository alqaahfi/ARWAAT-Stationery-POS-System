import React, { useState } from 'react';
import { Check, UserRound } from 'lucide-react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Avatar, Button, Card, Skeleton } from '../ui';
import PartyPicker from '../../pages/Ledgers/parts/PartyPicker';
import { PartyTypeBadge } from './BillSummary';

const c = theme.colors;

// Who the bill is with. A bill opened from a customer's or supplier's own page
// is `locked` to them. A sale with nobody chosen is a walk-in; a purchase
// always needs a supplier, so its picker is shown straight away.
export default function BillPartyCard({ kind, party, loading, locked, onPick, onClear }) {
  const isPurchase = kind === 'purchase';
  const [picking, setPicking] = useState(false);

  if (loading) {
    return (
      <Card padding={theme.spacing.smd}>
        <Skeleton height="36px" />
      </Card>
    );
  }

  if (party) {
    return (
      <Card padding={theme.spacing.smd}>
        <div style={styles.row}>
          <Avatar name={party.name} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...theme.type.headline, color: c.label }}>{party.name}</div>
            {party.phone && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{[party.phone, party.mobile].filter(Boolean).join(' · ')}</div>}
          </div>
          {!isPurchase && <PartyTypeBadge type={party.customer_type} />}
          {!locked && (
            <Button variant="plain" size="sm" onClick={onClear}>
              Change
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (!isPurchase && !picking) {
    return (
      <Card padding={theme.spacing.smd}>
        <div style={styles.row}>
          <UserRound size={20} color={c.labelSecondary} aria-hidden="true" />
          <div style={{ flex: 1, ...theme.type.headline, color: c.label }}>{glossary.walkIn}</div>
          <Button variant="tinted" size="sm" onClick={() => setPicking(true)}>
            Choose a customer
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card padding={theme.spacing.smd}>
      <div style={{ ...theme.type.headline, color: c.label, marginBottom: theme.spacing.sm }}>
        {isPurchase ? 'Who is this purchase from?' : 'Who is this sale for?'}
      </div>
      <PartyPicker
        party={isPurchase ? 'supplier' : 'customer'}
        compact
        showType={!isPurchase}
        onPick={(row) => {
          setPicking(false);
          onPick(row);
        }}
      />
      {!isPurchase && (
        <Button variant="plain" size="sm" icon={Check} onClick={() => setPicking(false)} style={{ marginTop: theme.spacing.sm }}>
          Continue as walk-in
        </Button>
      )}
    </Card>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd },
};
