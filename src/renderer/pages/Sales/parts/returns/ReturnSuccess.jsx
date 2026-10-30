import React from 'react';
import { Check } from 'lucide-react';
import theme from '../../../../config/theme';
import glossary from '../../../../config/glossary';
import BalanceChip from '../../../../components/BalanceChip';
import { Button, Card, IconTile } from '../../../../components/ui';
import { formatCurrencyExact } from '../../../../utils/format';

const c = theme.colors;

export function ReturnSuccess({ result, named, onDone, onSeeSale }) {
  return (
    <Card style={{ maxWidth: '480px', margin: `${theme.spacing.lg} auto 0` }}>
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: theme.spacing.sm }}>
        <IconTile icon={Check} color="green" size="lg" />
        <h2 style={{ ...theme.type.title2, color: c.label, margin: `${theme.spacing.sm} 0 0` }}>Return recorded</h2>
        <div style={{ ...theme.type.subhead, color: c.labelSecondary }}>{result.return_no}</div>
      </div>

      <div style={{ marginTop: theme.spacing.md }}>
        <Row label="Value" value={formatCurrencyExact(result.total_amount)} />
        <Row label="Cash back" value={formatCurrencyExact(result.cash_refund_amount)} />
        {named && <Row label={glossary.creditedToAccount} value={formatCurrencyExact(result.credited_amount)} />}
        {named && <Row label="New balance" value={<BalanceChip amount={result.new_balance} />} />}
      </div>

      {/* Rule 8: there is no exchange screen — an exchange is this return plus a new sale. */}
      <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: theme.spacing.md, textAlign: 'center' }}>
        Exchanging? Ring up what the customer takes as a New Sale.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        <Button size="lg" fullWidth onClick={onDone} autoFocus>
          Done
        </Button>
        {onSeeSale && (
          <Button variant="plain" fullWidth onClick={onSeeSale}>
            See the sale
          </Button>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '10px 0',
        borderTop: `1px solid ${c.separator}`,
        ...theme.type.body,
      }}
    >
      <span style={{ color: c.labelSecondary }}>{label}</span>
      <span style={{ ...theme.font.numeric, fontWeight: theme.font.weightSemibold, color: c.label }}>{value}</span>
    </div>
  );
}
