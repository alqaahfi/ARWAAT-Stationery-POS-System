import glossary from '../config/glossary';

// Stored tier values stay 'C1'..'C5'; people see "Price Level 1".."Price Level 5".
export const PRICE_LEVELS = ['C1', 'C2', 'C3', 'C4', 'C5'];

export function priceLevelLabel(tier) {
  const match = /^C([1-5])$/.exec(tier || '');
  return match ? glossary.priceLevel(match[1]) : glossary.noPriceLevel;
}
