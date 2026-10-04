import React from 'react';
import PartyProfile from '../Parties/PartyProfile';

export default function CustomerProfile({ customerId, onNavigate }) {
  return <PartyProfile party="customer" partyId={customerId} onNavigate={onNavigate} />;
}
