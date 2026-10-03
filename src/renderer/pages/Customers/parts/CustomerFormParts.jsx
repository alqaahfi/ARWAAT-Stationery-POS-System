import React from 'react';
import { BookOpen, CalendarDays, HandCoins, Mail, Phone, ShieldCheck, Smartphone, StickyNote } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Button, Disclosure, Field, NumberInput, SegmentedControl, Select, TextInput, Textarea } from '../../../components/ui';
import { PRICE_LEVELS, priceLevelLabel } from '../../../utils/priceLevel';
import { SectionCard } from '../../Products/form/fields';
import { PartyHeader, contactLine } from '../../Parties/PartyHeader';
import { OptionRow } from '../../Parties/PartyParts';
import { TypeBadge } from './CustomerListParts';

const TYPE_OPTIONS = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
];

export function CustomerHeader({ customer, balance, onOpenAccount, onReceivePayment }) {
  return (
    <PartyHeader
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
          <Button variant="plain" icon={BookOpen} onClick={onOpenAccount}>
            {glossary.openAccount}
          </Button>
          <Button icon={HandCoins} onClick={onReceivePayment}>
            {glossary.receivePayment}
          </Button>
        </>
      }
    />
  );
}

// Label text with a small leading icon (outside the input).
function IconLabel({ icon: IconComponent, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs }}>
      <IconComponent size={14} aria-hidden="true" />
      {children}
    </span>
  );
}

const twoCol = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: theme.spacing.sm };

export function BasicsCard({ name, onName, nameError, autoFocus, customerType, onCustomerType }) {
  return (
    <SectionCard dense title="Basics">
      <Field label="Name" required error={nameError}>
        <TextInput id="customer-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus={autoFocus} autoComplete="off" />
      </Field>
      <Field label="Type" hint="Wholesale customers get wholesale prices and an A4 invoice by default." style={{ marginBottom: 0 }}>
        <SegmentedControl label="Customer type" options={TYPE_OPTIONS} value={customerType} onChange={onCustomerType} />
      </Field>
    </SectionCard>
  );
}

export function ContactCard({ phone, onPhone, mobile, onMobile, email, onEmail }) {
  return (
    <SectionCard dense title="Contact">
      <div style={twoCol}>
        <Field label={<IconLabel icon={Phone}>Phone</IconLabel>}>
          <TextInput type="tel" value={phone} onChange={(e) => onPhone(e.target.value)} autoComplete="off" />
        </Field>
        <Field label={<IconLabel icon={Smartphone}>Mobile</IconLabel>}>
          <TextInput type="tel" value={mobile} onChange={(e) => onMobile(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <Field label={<IconLabel icon={Mail}>Email</IconLabel>} style={{ marginBottom: 0 }}>
        <TextInput type="email" value={email} onChange={(e) => onEmail(e.target.value)} autoComplete="off" />
      </Field>
    </SectionCard>
  );
}

export function AddressCard({ address, onAddress }) {
  return (
    <SectionCard dense title="Address">
      <Field label="Address" style={{ marginBottom: 0 }}>
        <Textarea value={address} onChange={(e) => onAddress(e.target.value)} rows={2} style={{ minHeight: '48px' }} />
      </Field>
    </SectionCard>
  );
}

export function CreditCard({ creditLimit, onCreditLimit, joiningDate, onJoiningDate }) {
  return (
    <SectionCard dense title="Credit and History">
      <div style={twoCol}>
        <Field
          label={<IconLabel icon={ShieldCheck}>Credit Limit</IconLabel>}
          hint="The most credit this customer can owe. Saved for reference only. 0 means no limit set."
          style={{ marginBottom: 0 }}
        >
          <NumberInput value={creditLimit} onChange={(e) => onCreditLimit(e.target.value)} />
        </Field>
        <Field label={<IconLabel icon={CalendarDays}>Joined</IconLabel>} style={{ marginBottom: 0 }}>
          <TextInput type="date" value={joiningDate} onChange={(e) => onJoiningDate(e.target.value)} />
        </Field>
      </div>
    </SectionCard>
  );
}

export function NotesCard({ notes, onNotes }) {
  return (
    <SectionCard dense title="Notes">
      <Field label={<IconLabel icon={StickyNote}>Notes</IconLabel>} style={{ marginBottom: 0 }}>
        <Textarea value={notes} onChange={(e) => onNotes(e.target.value)} rows={3} />
      </Field>
    </SectionCard>
  );
}

export function PricingCard({ tier, onTier, customerType, letterheads, letterheadId, onLetterheadId }) {
  return (
    <SectionCard dense title="Pricing">
      <Field
        label="Price Level"
        hint="Customers on a Price Level automatically get the special price you set for that level on each item. Leave as None for normal prices."
        style={customerType === 'wholesale' ? undefined : { marginBottom: 0 }}
      >
        <Select value={tier} onChange={(e) => onTier(e.target.value)}>
          <option value="">{glossary.noPriceLevel}</option>
          {PRICE_LEVELS.map((t) => (
            <option key={t} value={t}>
              {priceLevelLabel(t)}
            </option>
          ))}
        </Select>
      </Field>
      {customerType === 'wholesale' && (
        <Field label="Letterhead" hint="Used on this customer's A4 invoices." style={{ marginBottom: 0 }}>
          <Select value={letterheadId} onChange={(e) => onLetterheadId(e.target.value)}>
            <option value="">{glossary.shopDefaultLetterhead}</option>
            {letterheads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </SectionCard>
  );
}

export function CustomerMoreOptions({ isActive, onIsActive }) {
  return (
    <Disclosure title="More options" summary={isActive ? undefined : glossary.inactive}>
      <OptionRow label="Active" hint="Inactive customers don't show up when making a sale." checked={isActive} onChange={onIsActive} />
    </Disclosure>
  );
}
