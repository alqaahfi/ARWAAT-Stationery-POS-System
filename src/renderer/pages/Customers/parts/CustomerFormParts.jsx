import React from 'react';
import { BookOpen } from 'lucide-react';
import glossary from '../../../config/glossary';
import { Badge, Button, Disclosure, Field, SegmentedControl, Select, TextInput, Textarea } from '../../../components/ui';
import { PRICE_LEVELS, priceLevelLabel } from '../../../utils/priceLevel';
import { SectionCard, grid } from '../../Products/form/fields';
import { PartyHeader, contactLine } from '../../Parties/PartyHeader';
import { OptionRow } from '../../Parties/PartyParts';
import { TypeBadge } from './CustomerListParts';

const TYPE_OPTIONS = [
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
];

export function CustomerHeader({ customer, balance, onOpenAccount }) {
  return (
    <PartyHeader
      name={customer.name}
      party="customer"
      balance={balance}
      contact={contactLine(customer.phone, customer.address)}
      badges={
        <>
          <TypeBadge type={customer.customerType} />
          {customer.tier && <Badge>{priceLevelLabel(customer.tier)}</Badge>}
          {!customer.isActive && <Badge>{glossary.inactive}</Badge>}
        </>
      }
      actions={
        <Button icon={BookOpen} onClick={onOpenAccount}>
          {glossary.openAccount}
        </Button>
      }
    />
  );
}

export function BasicsCard({ name, onName, nameError, autoFocus, customerType, onCustomerType, phone, onPhone, address, onAddress }) {
  return (
    <SectionCard title="Basics">
      <Field label="Name" required error={nameError}>
        <TextInput id="customer-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus={autoFocus} autoComplete="off" />
      </Field>
      <Field label="Type" hint="Wholesale customers get wholesale prices and an A4 invoice by default.">
        <SegmentedControl label="Customer type" options={TYPE_OPTIONS} value={customerType} onChange={onCustomerType} />
      </Field>
      <div style={grid(220)}>
        <Field label="Phone">
          <TextInput value={phone} onChange={(e) => onPhone(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <Field label="Address" style={{ marginBottom: 0 }}>
        <Textarea value={address} onChange={(e) => onAddress(e.target.value)} rows={2} style={{ minHeight: '56px' }} />
      </Field>
    </SectionCard>
  );
}

export function PricingCard({ tier, onTier, customerType, letterheads, letterheadId, onLetterheadId }) {
  return (
    <SectionCard title="Pricing">
      <Field
        label="Price Level"
        hint="Customers on a Price Level automatically get the special price you set for that level on each item. Leave as None for normal prices."
        style={customerType === 'wholesale' ? undefined : { marginBottom: 0 }}
      >
        <Select value={tier} onChange={(e) => onTier(e.target.value)} style={{ maxWidth: '260px' }}>
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
          <Select value={letterheadId} onChange={(e) => onLetterheadId(e.target.value)} style={{ maxWidth: '360px' }}>
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
