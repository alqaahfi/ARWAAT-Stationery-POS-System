import React from 'react';
import { CalendarDays, Mail, PackagePlus, Phone, Send, Smartphone, StickyNote } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Button, Disclosure, Field, TextInput, Textarea } from '../../../components/ui';
import { SectionCard, grid } from '../../Products/form/fields';
import { PartyHeader, contactLine } from '../../Parties/PartyHeader';
import { OptionRow } from '../../Parties/PartyParts';

export function SupplierHeader({ supplier, balance, onPay, onNewPurchase }) {
  return (
    <PartyHeader
      name={supplier.name}
      party="supplier"
      balance={balance}
      contact={contactLine(supplier.contactPerson, supplier.phone, supplier.mobile, supplier.address)}
      badges={!supplier.isActive ? <Badge>{glossary.inactive}</Badge> : null}
      actions={
        <>
          <Button variant="plain" icon={PackagePlus} onClick={onNewPurchase}>
            {glossary.newPurchase}
          </Button>
          <Button icon={Send} onClick={onPay}>
            {glossary.paySupplier}
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

export function SupplierBasicsCard({ name, onName, nameError, autoFocus, contactPerson, onContactPerson }) {
  return (
    <SectionCard dense title="Basics">
      <Field label="Name" required error={nameError}>
        <TextInput id="supplier-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus={autoFocus} autoComplete="off" />
      </Field>
      <Field label="Contact person" style={{ marginBottom: 0 }}>
        <TextInput value={contactPerson} onChange={(e) => onContactPerson(e.target.value)} autoComplete="off" />
      </Field>
    </SectionCard>
  );
}

export function SupplierContactCard({ phone, onPhone, mobile, onMobile, email, onEmail }) {
  return (
    <SectionCard dense title="Contact">
      <div style={grid(120)}>
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

export function SupplierAddressCard({ address, onAddress }) {
  return (
    <SectionCard dense title="Address">
      <Field label="Address" style={{ marginBottom: 0 }}>
        <Textarea value={address} onChange={(e) => onAddress(e.target.value)} rows={2} style={{ minHeight: '56px' }} />
      </Field>
    </SectionCard>
  );
}

export function SupplierHistoryCard({ joiningDate, onJoiningDate }) {
  return (
    <SectionCard dense title="History">
      <Field label={<IconLabel icon={CalendarDays}>Joined</IconLabel>} style={{ marginBottom: 0 }}>
        <TextInput type="date" value={joiningDate} onChange={(e) => onJoiningDate(e.target.value)} />
      </Field>
    </SectionCard>
  );
}

export function SupplierNotesCard({ notes, onNotes }) {
  return (
    <SectionCard dense title="Notes">
      <Field label={<IconLabel icon={StickyNote}>Notes</IconLabel>} style={{ marginBottom: 0 }}>
        <Textarea value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="Anything worth remembering about this supplier" rows={3} />
      </Field>
    </SectionCard>
  );
}

export function SupplierMoreOptions({ isEdit, isActive, onIsActive }) {
  return (
    <Disclosure title="More options" summary={isEdit && !isActive ? glossary.inactive : undefined}>
      {isEdit ? (
        <OptionRow label="Active" hint="Inactive suppliers can't be chosen when recording a purchase." checked={isActive} onChange={onIsActive} />
      ) : (
        <div style={{ color: theme.colors.labelTertiary }}>No extra options for a new supplier.</div>
      )}
    </Disclosure>
  );
}
