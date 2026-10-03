import React from 'react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Disclosure } from '../../../components/ui';
import { formatCurrency } from '../../../utils/format';
import { Intro, NumInput } from './fields';

const c = theme.colors;
export const TIER_KEYS = ['netRateC1', 'netRateC2', 'netRateC3', 'netRateC4', 'netRateC5'];

const DISCOUNT_KEYS = ['saleDiscountC1', 'saleDiscountC2', 'saleDiscountC3', 'saleDiscountC4', 'saleDiscountC5'];
const isSet = (v) => v !== '' && v !== null && v !== undefined;

export function countSpecialPrices(units) {
  return units.reduce((sum, u) => sum + (u.pricingMethod === 'trade' ? DISCOUNT_KEYS : TIER_KEYS).filter((k) => isSet(u[k])).length, 0);
}

// Section 4 — collapsed by default. One row per pack size, five boxes.
export function SpecialPricesSection({ units, onUpdateUnit }) {
  const setCount = countSpecialPrices(units);
  const named = units.filter((u) => u.unitName.trim());
  const th = { ...theme.type.footnote, fontWeight: theme.font.weightSemibold, color: c.labelSecondary, padding: '0 4px 6px', whiteSpace: 'nowrap' };

  return (
    <Disclosure title={glossary.specialPrices} summary={setCount ? `${setCount} price${setCount === 1 ? '' : 's'} set` : 'None set'}>
      <Intro>Customers assigned to a Price Level get that price automatically. Leave a box empty to use the normal price. Trade Price pack sizes take a % off the trade price instead.</Intro>
      {named.length === 0 ? (
        <div style={{ ...theme.type.subhead, color: c.labelSecondary }}>Add a pack size first.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', ...theme.type.subhead }}>
            <thead>
              <tr>
                <th scope="col" style={{ ...th, textAlign: 'left' }}>
                  Pack size
                </th>
                {TIER_KEYS.map((k, i) => (
                  <th key={k} scope="col" style={{ ...th, textAlign: 'right' }}>
                    {glossary.priceLevel(i + 1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u, index) =>
                u.unitName.trim() ? (
                  <tr key={u.id ?? `new-${index}`}>
                    <th scope="row" style={{ textAlign: 'left', padding: '4px', fontWeight: theme.font.weightMedium, color: c.label, whiteSpace: 'nowrap' }}>
                      {u.unitName}
                      <div style={{ ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, fontWeight: 400 }}>{u.pricingMethod === 'trade' ? 'Trade' : 'Retail'} {formatCurrency(u.pricingMethod === 'trade' ? u.tradePrice || 0 : u.retailPrice)}</div>
                    </th>
                    {TIER_KEYS.map((k, i) => {
                      const trade = u.pricingMethod === 'trade';
                      const key = trade ? DISCOUNT_KEYS[i] : k;
                      return (
                        <td key={k} style={{ padding: '4px', minWidth: '96px' }}>
                          <NumInput
                            aria-label={`${u.unitName} — ${glossary.priceLevel(i + 1)}${trade ? ' discount %' : ''}`}
                            value={u[key]}
                            placeholder={trade ? '— %' : '—'}
                            onChange={(v) => onUpdateUnit(index, { [key]: v })}
                          />
                          {trade && isSet(u[k]) && (
                            <div style={{ ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, textAlign: 'right' }}>{formatCurrency(u[k])}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ) : null
              )}
            </tbody>
          </table>
        </div>
      )}
    </Disclosure>
  );
}
