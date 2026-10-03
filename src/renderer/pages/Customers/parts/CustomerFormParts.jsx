import React from 'react';
import { HandCoins, ShoppingCart } from 'lucide-react';
import glossary from '../../../config/glossary';
import { Badge, Button, NumberInput, SegmentedControl, Select, TextInput, Textarea, Toggle } from '../../../components/ui';
import { PRICE_LEVELS, priceLevelLabel } from '../../../utils/priceLevel';
import { PartyHeader, contactLine } from '../../Parties/PartyHeader';
import { FormRow } from '../../Parties/PartyParts';
import { TypeBadge } from './CustomerListParts';

const TYPE_OPTIONS = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
];

const textareaStyle = { minHeight: '56px', height: '56px', resize: 'none' };

export function CustomerHeader({ customer, balance, onNewSale, onPayment }) {
  return (
    <PartyHeader
      bare
      name={customer.name}
      party="customer"
      balance={balance}
      contact={contactLine(customer.phone, customer.mobile, customer.address)}
      badges={
        <>
          <TypeBadge type={customer.customerType} />
          {customer.tier && <Badge>{priceLevelLabel(customer.tier)}</Badge>}
          {!customer.isActive && <Badge>{glossary.inactive}</Badge>}
        </>
      }
      actions={
        <>
          <Button variant="secondary" icon={HandCoins} onClick={onPayment}>
            {glossary.payment}
          </Button>
          <Button icon={ShoppingCart} onClick={onNewSale}>
            {glossary.newSale}
          </Button>
        </>
      }
    />
  );
}

export function NameRow({ name, onName, nameError, autoFocus }) {
  return (
    <FormRow label="Name" required error={nameError}>
      <TextInput id="customer-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus={autoFocus} autoComplete="off" />
    </FormRow>
  );
}

export function TypeRow({ customerType, onCustomerType }) {
  return (
    <FormRow label="Type">
      <SegmentedControl label="Customer type" options={TYPE_OPTIONS} value={customerType} onChange={onCustomerType} />
    </FormRow>
  );
}

export function ContactRows({ phone, onPhone, mobile, onMobile, email, onEmail }) {
  return (
    <>
      <FormRow label="Phone">
        <TextInput type="tel" value={phone} onChange={(e) => onPhone(e.target.value)} autoComplete="off" />
      </FormRow>
      <FormRow label="Mobile">
        <TextInput type="tel" value={mobile} onChange={(e) => onMobile(e.target.value)} autoComplete="off" />
      </FormRow>
      <FormRow label="Email">
        <TextInput type="email" value={email} onChange={(e) => onEmail(e.target.value)} autoComplete="off" />
      </FormRow>
    </>
  );
}

export function AddressRow({ address, onAddress }) {
  return (
    <FormRow label="Address" top>
      <Textarea value={address} onChange={(e) => onAddress(e.target.value)} rows={2} style={textareaStyle} />
    </FormRow>
  );
}

export function PricingRows({ tier, onTier, customerType, letterheads, letterheadId, onLetterheadId }) {
  return (
    <>
      <FormRow label="Price level">
        <Select value={tier} onChange={(e) => onTier(e.target.value)}>
          <option value="">{glossary.noPriceLevel}</option>
          {PRICE_LEVELS.map((t) => (
            <option key={t} value={t}>
              {priceLevelLabel(t)}
            </option>
          ))}
        </Select>
      </FormRow>
      {customerType === 'wholesale' && (
        <FormRow label="Letterhead">
          <Select value={letterheadId} onChange={(e) => onLetterheadId(e.target.value)}>
            <option value="">{glossary.shopDefaultLetterhead}</option>
            {letterheads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </FormRow>
      )}
    </>
  );
}

export function CreditRows({ creditLimit, onCreditLimit, joiningDate, onJoiningDate }) {
  return (
    <>
      <FormRow label="Credit limit" hint="0 means no limit. Saved for reference only.">
        <NumberInput value={creditLimit} onChange={(e) => onCreditLimit(e.target.value)} />
      </FormRow>
      <FormRow label="Joined">
        <TextInput type="date" value={joiningDate} onChange={(e) => onJoiningDate(e.target.value)} />
      </FormRow>
    </>
  );
}

export function NotesRow({ notes, onNotes }) {
  return (
    <FormRow label="Notes" top>
      <Textarea value={notes} onChange={(e) => onNotes(e.target.value)} rows={2} style={textareaStyle} />
    </FormRow>
  );
}

export function ActiveRow({ isActive, onIsActive }) {
  return (
    <FormRow label="Active" hint="Inactive customers don't show up when making a sale.">
      <Toggle checked={isActive} onChange={onIsActive} label="Active" />
    </FormRow>
  );
}
