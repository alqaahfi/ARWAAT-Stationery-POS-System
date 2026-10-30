import { formatCurrency } from './format';

// Rule 6: a selling price below the buying price is a warning, allowed after a
// confirm. Same check as main/pricing/belowCost.js (product form units shape).
const LEVELS = [
  ['retailPrice', 'Retail'],
  ['wholesalePrice', 'Wholesale'],
  ['netRateC1', 'Price Level 1'],
  ['netRateC2', 'Price Level 2'],
  ['netRateC3', 'Price Level 3'],
  ['netRateC4', 'Price Level 4'],
  ['netRateC5', 'Price Level 5'],
];

export function belowCostIssues(units) {
  const issues = [];
  for (const u of units || []) {
    const cost = Number(u.costPrice) || 0;
    if (cost <= 0) continue;
    for (const [key, label] of LEVELS) {
      const v = u[key];
      if (v === null || v === undefined || v === '') continue;
      const price = Number(v);
      if (Number.isFinite(price) && price < cost - 0.005) issues.push({ unitName: u.unitName, level: label, price, cost });
    }
  }
  return issues;
}

export function belowCostMessage(issues, max = 4) {
  const lines = issues
    .slice(0, max)
    .map((i) => `${i.unitName ? `${i.unitName} · ` : ''}${i.level} ${formatCurrency(i.price)} (buying ${formatCurrency(i.cost)})`);
  const more = issues.length > max ? ` and ${issues.length - max} more` : '';
  return `${lines.join('; ')}${more}. You will lose money on every sale at this price.`;
}
