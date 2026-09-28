import React from 'react';
import { PackagePlus, Send } from 'lucide-react';
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
      contact={contactLine(supplier.contactPerson, supplier.phone, supplier.address)}
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

export function SupplierBasicsCard({ name, onName, nameError, autoFocus, contactPerson, onContactPerson, phone, onPhone, address, onAddress }) {
  return (
    <SectionCard title="Basics">
      <Field label="Name" required error={nameError}>
        <TextInput id="supplier-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus={autoFocus} autoComplete="off" />
      </Field>
      <div style={grid(220)}>
        <Field label="Contact person">
          <TextInput value={contactPerson} onChange={(e) => onContactPerson(e.target.value)} autoComplete="off" />
        </Field>
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

export function SupplierMoreOptions({ isEdit, notes, onNotes, isActive, onIsActive }) {
  const summary = isEdit && !isActive ? glossary.inactive : notes.trim() ? 'Has notes' : undefined;
  return (
    <Disclosure title="More options" summary={summary}>
      <Field label="Notes" style={{ marginBottom: isEdit ? undefined : 0 }}>
        <Textarea value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="Anything worth remembering about this supplier" rows={3} />
      </Field>
      {isEdit && (
        <OptionRow label="Active" hint="Inactive suppliers can't be chosen when recording a purchase." checked={isActive} onChange={onIsActive} />
      )}
    </Disclosure>
  );
}
