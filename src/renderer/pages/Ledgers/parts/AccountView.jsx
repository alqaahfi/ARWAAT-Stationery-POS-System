import React, { useId } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import { Button, Card, Modal } from '../../../components/ui';
import { PartyHeader } from '../../Parties/PartyHeader';
import { LoadError } from '../../Parties/PartyParts';
import AccountList from './AccountList';
import TransactionTimeline from './TransactionTimeline';
import { AccountSkeleton, ledgerPage } from './LedgerParts';

const c = theme.colors;

// One layout for Customer Accounts and Supplier Accounts. No party chosen ->
// the picker; otherwise the account header and its full timeline.
export function AccountView({ party, picking, onPick, loading, error, onRetry, data, name, badges, contact, onPay, onChooseAnother }) {
  const isSupplier = party === 'supplier';
  const noun = isSupplier ? 'supplier' : 'customer';

  if (picking) {
    return (
      <div style={ledgerPage}>
        <AccountList party={party} onPick={onPick} />
      </div>
    );
  }

  let body;
  if (!data && (loading || !error)) body = <AccountSkeleton />;
  else if (!data) {
    body = (
      <Card>
        <LoadError message={error || `This ${noun}'s account couldn't be loaded.`} onRetry={onRetry} />
      </Card>
    );
  } else {
    body = (
      <>
        <PartyHeader
          name={name}
          party={party}
          badges={badges}
          contact={contact}
          balance={data.balance}
          actions={
            <>
              <Button variant="plain" icon={ArrowLeftRight} onClick={onChooseAnother}>
                {`Choose another ${noun}`}
              </Button>
              <Button icon={isSupplier ? appIcons.paySupplier.icon : appIcons.receivePayment.icon} onClick={onPay}>
                Payment
              </Button>
            </>
          }
        />
        <Card padding="0" style={{ overflow: 'hidden' }}>
          <h2 style={{ ...theme.type.headline, color: c.label, margin: 0, padding: `14px ${theme.spacing.md}` }}>Transactions</h2>
          <TransactionTimeline rows={data.transactions} openingBalance={data.openingBalance} openingDate={data.openingDate} />
        </Card>
      </>
    );
  }

  return <div style={ledgerPage}>{body}</div>;
}

// Modal shell around PaymentFormFields. Enter in any field submits.
export function PaymentModal({ open, title, saving, onSubmit, onClose, children }) {
  const formId = useId();
  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      dismissible={!saving}
      title={title}
      width={440}
      footer={
        <>
          <Button variant="plain" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Record payment
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate>
        {children}
      </form>
    </Modal>
  );
}
