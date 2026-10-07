import React, { useId } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { LedgerBackBar } from './LedgerNav';
import appIcons from '../../../config/appIcons';
import { Button, Card, Modal } from '../../../components/ui';
import { PartyHeader } from '../../Parties/PartyHeader';
import { LoadError } from '../../Parties/PartyParts';
import AccountList from './AccountList';
import TransactionTimeline from './TransactionTimeline';
import { AccountSkeleton, ledgerPage } from './LedgerParts';
import useDeletePayment from '../../../utils/useDeletePayment';

const c = theme.colors;

// One layout for Customer Accounts and Supplier Accounts. No party chosen ->
// the picker; otherwise the account header and its full timeline.
export function AccountView({ party, picking, onPick, loading, error, onRetry, data, name, badges, contact, onPay, onChooseAnother, onNavigate }) {
  const deletePayment = useDeletePayment();
  const isSupplier = party === 'supplier';
  const noun = isSupplier ? 'supplier' : 'customer';
  const listLabel = isSupplier ? glossary.supplierAccounts : glossary.customerAccounts;
  const toLedgers = () => onNavigate?.('/ledgers');

  if (picking) {
    return (
      <div style={ledgerPage}>
        <LedgerBackBar crumbs={[{ label: glossary.ledgers, onClick: toLedgers }]} current={listLabel} />
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
          <TransactionTimeline
            rows={data.transactions}
            openingBalance={data.openingBalance}
            openingDate={data.openingDate}
            onDeletePayment={async (row) => {
              if (await deletePayment({ paymentId: row.paymentId, amount: row.credit, partyName: name })) onRetry?.();
            }}
          />
        </Card>
      </>
    );
  }

  return (
    <div style={ledgerPage}>
      <LedgerBackBar
        crumbs={[
          { label: glossary.ledgers, onClick: toLedgers },
          { label: listLabel, onClick: onChooseAnother },
        ]}
        current={name || (isSupplier ? glossary.supplier : glossary.customer)}
      />
      {body}
    </div>
  );
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
