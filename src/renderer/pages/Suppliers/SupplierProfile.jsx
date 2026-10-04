import React from 'react';
import PartyProfile from '../Parties/PartyProfile';

export default function SupplierProfile({ supplierId, onNavigate }) {
  return <PartyProfile party="supplier" partyId={supplierId} onNavigate={onNavigate} />;
}
