import React from 'react';
import { PackagePlus, Send } from 'lucide-react';
import glossary from '../../../config/glossary';
import { Badge, Button, TextInput, Textarea, Toggle } from '../../../components/ui';
import { PartyHeader, contactLine } from '../../Parties/PartyHeader';
import { FormRow } from '../../Parties/PartyParts';

const textareaStyle = { minHeight: '56px', height: '56px', resize: 'none' };

export function SupplierHeader({ supplier, balance, onPay, onNewPurchase }) {
  return (
    <PartyHeader
      bare
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

export function SupplierNameRow({ name, onName, nameError, autoFocus }) {
  return (
    <FormRow label="Name" required error={nameError}>
      <TextInput id="supplier-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus={autoFocus} autoComplete="off" />
    </FormRow>
  );
}

export function SupplierContactRows({ contactPerson, onContactPerson, phone, onPhone, mobile, onMobile, email, onEmail }) {
  return (
    <>
      <FormRow label="Contact person">
        <TextInput value={contactPerson} onChange={(e) => onContactPerson(e.target.value)} autoComplete="off" />
      </FormRow>
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

export function SupplierAddressRow({ address, onAddress }) {
  return (
    <FormRow label="Address" top>
      <Textarea value={address} onChange={(e) => onAddress(e.target.value)} rows={2} style={textareaStyle} />
    </FormRow>
  );
}

export function SupplierJoinedRow({ joiningDate, onJoiningDate }) {
  return (
    <FormRow label="Joined">
      <TextInput type="date" value={joiningDate} onChange={(e) => onJoiningDate(e.target.value)} />
    </FormRow>
  );
}

export function SupplierNotesRow({ notes, onNotes }) {
  return (
    <FormRow label="Notes" top>
      <Textarea
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        placeholder="Anything worth remembering about this supplier"
        rows={2}
        style={textareaStyle}
      />
    </FormRow>
  );
}

export function SupplierActiveRow({ isActive, onIsActive }) {
  return (
    <FormRow label="Active" hint="Inactive suppliers can't be chosen when recording a purchase.">
      <Toggle checked={isActive} onChange={onIsActive} label="Active" />
    </FormRow>
  );
}
