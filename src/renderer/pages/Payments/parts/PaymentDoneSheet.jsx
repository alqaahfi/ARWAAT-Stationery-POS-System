import React, { useState } from 'react';
import { CircleAlert, CircleCheck, RotateCw } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Icon, IconTile, Modal, Skeleton } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { formatCurrency } from '../../../utils/format';

const c = theme.colors;

// Shown once a payment is saved. Printing happens only when a receipt size is
// chosen; a failed print keeps the sheet open with a Retry — the payment
// itself is already saved either way.
export default function PaymentDoneSheet({ open, amount, balance, balanceLoading, party = 'customer', onPrint, onClose }) {
  const [printing, setPrinting] = useState(null);
  const [failed, setFailed] = useState(null); // { format, message }

  async function print(format) {
    setPrinting(format);
    setFailed(null);
    let res;
    try {
      res = await onPrint(format);
    } catch (err) {
      res = { success: false, reason: err?.message };
    }
    setPrinting(null);
    if (res?.success || res?.canceled) {
      onClose();
      return;
    }
    setFailed({ format, message: res?.reason || "The receipt couldn't be printed." });
  }

  function close() {
    if (printing) return;
    setFailed(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} width={420} dismissible={!printing}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <IconTile icon={CircleCheck} color="green" variant="soft" size="xl" />
        <h2 style={{ ...theme.type.title2, margin: `${theme.spacing.smd} 0 0` }}>Payment recorded</h2>
        <div style={{ ...theme.type.largeTitle, ...theme.font.numeric, color: c.label, marginTop: '6px' }}>{formatCurrency(amount)}</div>
        <div style={{ marginTop: theme.spacing.sm, minHeight: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>Now:</span>
          {balanceLoading ? <Skeleton width="120px" height="16px" /> : <BalanceChip amount={balance} party={party} />}
        </div>

        {failed && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.md,
              padding: '8px 12px',
              borderRadius: theme.radius.md,
              backgroundColor: c.redTint,
              color: c.redText,
              ...theme.type.subhead,
              textAlign: 'left',
            }}
          >
            <Icon icon={CircleAlert} size={16} />
            <span style={{ flex: 1 }}>{failed.message} The payment is saved.</span>
            <Button variant="danger" size="sm" icon={RotateCw} onClick={() => print(failed.format)} loading={!!printing}>
              Retry
            </Button>
          </div>
        )}

        <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: theme.spacing.md }}>Print a receipt?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <Button variant="tinted" onClick={() => print('thermal')} loading={printing === 'thermal'} disabled={!!printing && printing !== 'thermal'} autoFocus>
            {glossary.smallReceipt}
          </Button>
          <Button variant="tinted" onClick={() => print('a4')} loading={printing === 'a4'} disabled={!!printing && printing !== 'a4'}>
            {glossary.a4Receipt}
          </Button>
          <Button variant="plain" onClick={close} disabled={!!printing}>
            {glossary.noReceipt}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
