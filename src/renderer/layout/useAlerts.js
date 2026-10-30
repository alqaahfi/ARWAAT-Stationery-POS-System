import { useEffect, useState } from 'react';
import appIcons from '../config/appIcons';
import glossary from '../config/glossary';
import { SALE_COMPLETED_EVENT } from '../pages/POS/Sale';
import { STOCK_CHANGED_EVENT } from '../utils/appEvents';

const REFRESH_INTERVAL_MS = 60000;

// The alerts shown in the top bar's bell and on the Home page's "Needs
// attention" card — one definition so both always agree on what and where.
export const ALERT_TYPES = [
  { key: 'low', label: glossary.runningLow, route: '/products/low-stock', ...appIcons.runningLow, tone: 'orange' },
  { key: 'dead', label: glossary.notSelling, route: '/products/dead-stock', ...appIcons.notSelling, tone: 'neutral' },
  { key: 'overdue', label: `${glossary.overduePayments} (90+ days)`, route: '/ledgers/aging', ...appIcons.overdue, tone: 'red' },
  // Rule 11: items added at the counter wait for the Admin (buying price, approve or merge).
  { key: 'review', label: 'Items added at the counter (needs review)', route: '/products/needs-review', ...appIcons.products, tone: 'orange' },
  // Rule 12: sold without enough stock, or stock below zero.
  { key: 'recount', label: 'Stock to recount', route: '/stock/recount', ...appIcons.runningLow, tone: 'red' },
  // A newer version is ready (Admin window only: the call is refused for a cashier).
  { key: 'update', label: 'Update available', route: '/settings/updates', ...appIcons.sync, tone: 'blue' },
];

// Counts per alert key, refreshed every minute and after each sale.
// `loaded` turns true after the first successful fetch.
export default function useAlerts() {
  const [counts, setCounts] = useState({ low: 0, dead: 0, overdue: 0, review: 0, recount: 0, update: 0, updateVersion: '', loaded: false });
  useEffect(() => {
    let alive = true;
    function refresh() {
      Promise.all([
        window.api.products.getLowStock(),
        window.api.products.getDeadStock(),
        window.api.ledgers.getAgingReport(),
        window.api.products.listNeedsReview().catch(() => null),
        window.api.stock.listRecount().catch(() => null),
        window.api.updates.getState().catch(() => null),
      ])
        .then(([low, dead, aging, review, recount, update]) => {
          const updateReady = ['available', 'downloading', 'downloaded'].includes(update?.status) && update?.available;
          if (alive) {
            setCounts({
              low: low.length,
              dead: dead.length,
              overdue: aging.filter((r) => r.b90plus > 0).length,
              review: review?.rows?.length || 0,
              recount: recount?.count || 0,
              update: updateReady ? 1 : 0,
              updateVersion: updateReady ? update.available.version : '',
              loaded: true,
            });
          }
        })
        .catch(() => {});
    }
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener(SALE_COMPLETED_EVENT, refresh);
    window.addEventListener(STOCK_CHANGED_EVENT, refresh);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener(SALE_COMPLETED_EVENT, refresh);
      window.removeEventListener(STOCK_CHANGED_EVENT, refresh);
    };
  }, []);
  return counts;
}
