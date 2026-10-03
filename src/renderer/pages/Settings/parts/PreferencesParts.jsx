import React from 'react';
import { BadgePercent, Banknote, TrendingDown } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { ListSection, NumberInput, TextInput } from '../../../components/ui';
import { SettingRow } from './SettingsParts';

const c = theme.colors;

function Suffix({ children }) {
  return <span style={{ ...theme.type.body, color: c.labelSecondary }}>{children}</span>;
}

const onlyNumber = (fn) => (e) => {
  if (/^\d*\.?\d*$/.test(e.target.value)) fn(e.target.value);
};

export function PreferenceSections({ values, onChange }) {
  return (
    <>
      <ListSection title="Shop">
        <SettingRow
          icon={Banknote}
          color="green"
          title="Currency symbol"
          subtitle="Printed with amounts on receipts and invoices, e.g. “Rs.” or “$”."
          control={(id) => (
            <TextInput id={id} value={values.currencySymbol} onChange={(e) => onChange('currencySymbol', e.target.value)} style={{ width: '90px', textAlign: 'center' }} />
          )}
        />
      </ListSection>

      <ListSection title="Products">
        <SettingRow
          icon={TrendingDown}
          color="orange"
          title="Low-stock warning for new products"
          subtitle="Fills in “Warn me when stock is below” when you add a product. Existing products don’t change."
          control={(id) => (
            <NumberInput id={id} value={values.defaultLowStockAlert} placeholder="0" onChange={onlyNumber((v) => onChange('defaultLowStockAlert', v))} style={{ width: '90px' }} />
          )}
        />
      </ListSection>

      <ListSection title="Sales">
        <SettingRow
          icon={BadgePercent}
          color="orange"
          title={`Shop default ${glossary.maxDiscount.toLowerCase()}`}
          subtitle="The biggest discount a cashier can give, unless their own profile sets a different one."
          control={(id) => (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <NumberInput
                id={id}
                value={values.defaultCashierDiscountCap}
                placeholder="0"
                onChange={onlyNumber((v) => onChange('defaultCashierDiscountCap', v))}
                style={{ width: '90px' }}
              />
              <Suffix>%</Suffix>
            </div>
          )}
        />
      </ListSection>
    </>
  );
}
