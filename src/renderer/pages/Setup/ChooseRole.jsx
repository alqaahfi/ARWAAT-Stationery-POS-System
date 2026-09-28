import React, { useState } from 'react';
import { Store } from 'lucide-react';
import glossary from '../../config/glossary';
import appIcons from '../../config/appIcons';
import { Button } from '../../components/ui';
import SetupShell, { ChoiceCard } from './SetupShell';

// Step 1 of setup: is this the owner's main computer or a counter computer?
export default function ChooseRole({ onChoose }) {
  const [role, setRole] = useState(null);

  function submit() {
    if (role) onChoose(role);
  }

  return (
    <SetupShell
      step={1}
      totalSteps={role === 'cashier' ? 4 : 5}
      title="Set up this computer"
      subtitle="What will this computer be used for?"
      onSubmit={submit}
      footer={
        <Button type="submit" size="lg" fullWidth disabled={!role}>
          Continue
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <ChoiceCard
          icon={Store}
          color="blue"
          title={glossary.mainComputer}
          description="For the shop owner. Manage products, customers, money and reports."
          selected={role === 'admin'}
          onClick={() => setRole('admin')}
          onDoubleClick={() => onChoose('admin')}
        />
        <ChoiceCard
          icon={appIcons.sell.icon}
          color={appIcons.sell.color}
          title={glossary.counterComputer}
          description="For cashiers. Sell items and print receipts. The main computer must be set up first."
          selected={role === 'cashier'}
          onClick={() => setRole('cashier')}
          onDoubleClick={() => onChoose('cashier')}
        />
      </div>
    </SetupShell>
  );
}
