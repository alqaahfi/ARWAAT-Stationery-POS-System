import React from 'react';
import appIcons from '../../../config/appIcons';
import glossary from '../../../config/glossary';
import { ListSection } from '../../../components/ui';
import { NavRow } from './Panel';

const ACTIONS = [
  { label: glossary.newSale, route: '/pos', ...appIcons.sell },
  { label: glossary.receivePayment, route: '/payments/record', ...appIcons.receivePayment },
  { label: glossary.addProduct, route: '/products/new', ...appIcons.products },
  { label: glossary.addCustomer, route: '/customers/new', ...appIcons.customers },
];

export default function QuickActionsCard({ onNavigate }) {
  return (
    <ListSection title="Quick actions" style={{ marginBottom: 0 }}>
      {ACTIONS.map((a) => (
        <NavRow key={a.route} icon={a.icon} color={a.color} title={a.label} onClick={() => onNavigate(a.route)} />
      ))}
    </ListSection>
  );
}
