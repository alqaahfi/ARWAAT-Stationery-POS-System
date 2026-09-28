import { useEffect, useState } from 'react';
import appIcons from '../config/appIcons';
import glossary from '../config/glossary';
import { SALE_COMPLETED_EVENT } from '../pages/POS/Sale';

const REFRESH_INTERVAL_MS = 60000;

// The alerts shown in the top bar's bell and on the Home page's "Needs
// attention" card — one definition so both always agree on what and where.
export const ALERT_TYPES = [
  { key: 'low', label: glossary.runningLow, route: '/products/low-stock', ...appIcons.runningLow, tone: 'orange' },
  { key: 'dead', label: glossary.notSelling, route: '/products/dead-stock', ...appIcons.notSelling, tone: 'neutral' },
  { key: 'overdue', label: `${glossary.overduePayments} (90+ days)`, route: '/ledgers/aging', ...appIcons.overdue, tone: 'red' },
];

// Counts per alert key, refreshed every minute and after each sale.
// `loaded` turns true after the first successful fetch.
export default function useAlerts() {
  const [counts, setCounts] = useState({ low: 0, dead: 0, overdue: 0, loaded: false });
  useEffect(() => {
    let alive = true;
    function refresh() {
      Promise.all([
        window.api.products.getLowStock(),
        window.api.products.getDeadStock(),
        window.api.ledgers.getAgingReport(),
      ])
        .then(([low, dead, aging]) => {
          if (alive) {
            setCounts({ low: low.length, dead: dead.length, overdue: aging.filter((r) => r.b90plus > 0).length, loaded: true });
          }
        })
        .catch(() => {});
    }
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener(SALE_COMPLETED_EVENT, refresh);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener(SALE_COMPLETED_EVENT, refresh);
    };
  }, []);
  return counts;
}
