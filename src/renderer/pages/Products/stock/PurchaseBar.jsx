import React from 'react';
import { CircleCheck, History, Plus } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Card, IconTile, ListRow, ListSection } from '../../../components/ui';
import { formatCount, formatCurrency } from '../../../utils/format';

const c = theme.colors;

// Sticky bottom bar: item count, total and the one primary action.
// Right padding keeps clear of the Dev Panel corner trigger.
export function PurchaseBar({ count, total, saving, onSave }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: `${theme.spacing.smd} 64px ${theme.spacing.smd} ${theme.spacing.md}`,
        backgroundColor: c.surface,
        borderTop: `1px solid ${c.separator}`,
        borderRadius: `${theme.radius.lg} ${theme.radius.lg} 0 0`,
      }}
    >
      <span style={{ ...theme.type.subhead, ...theme.font.numeric, color: c.labelSecondary }}>{formatCount(count)} items</span>
      <div style={{ flex: 1 }} />
      <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>Total</span>
      <span style={{ ...theme.type.title1, ...theme.font.numeric, color: c.label }}>{formatCurrency(total)}</span>
      <Button size="lg" loading={saving} onClick={onSave}>
        Save purchase
      </Button>
    </div>
  );
}

// Replaces the form after a successful save.
export function PurchaseDone({ supplierName, itemCount, total, referenceNo, onNew, onHistory }) {
  return (
    <Card style={{ textAlign: 'center', padding: theme.spacing.xl }}>
      <IconTile icon={CircleCheck} color="green" size="lg" />
      <div style={{ ...theme.type.title2, color: c.label, margin: `${theme.spacing.smd} 0 ${theme.spacing.lg}` }}>Purchase saved</div>
      <div style={{ textAlign: 'left', maxWidth: '420px', margin: '0 auto' }}>
        <ListSection>
          <ListRow title="Supplier" value={supplierName} />
          {referenceNo && <ListRow title="Bill / reference number" value={referenceNo} />}
          <ListRow title="Items" value={formatCount(itemCount)} />
          <ListRow title="Total" value={formatCurrency(total)} />
        </ListSection>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: theme.spacing.sm }}>
        <Button size="lg" icon={Plus} onClick={onNew} autoFocus>
          New purchase
        </Button>
        {onHistory && (
          <Button size="lg" variant="plain" icon={History} onClick={onHistory}>
            See {glossary.stockHistory.toLowerCase()}
          </Button>
        )}
      </div>
    </Card>
  );
}
