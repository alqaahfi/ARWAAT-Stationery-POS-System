// Rule 6: a selling price below the buying price is a WARNING (shown before
// saving, allowed after a confirm). Same check as renderer/utils/belowCost.js.
// Units use the products:create/update payload shape.
const LEVELS = [
  ['retailPrice', 'Retail'],
  ['wholesalePrice', 'Wholesale'],
  ['netRateC1', 'Price Level 1'],
  ['netRateC2', 'Price Level 2'],
  ['netRateC3', 'Price Level 3'],
  ['netRateC4', 'Price Level 4'],
  ['netRateC5', 'Price Level 5'],
];

function belowCostIssues(units) {
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

module.exports = { belowCostIssues };
