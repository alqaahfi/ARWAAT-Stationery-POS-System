import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import theme from '../config/theme';
import { SALE_COMPLETED_EVENT } from '../pages/POS/Sale';

const c = theme.colors;
const CHECK_EVERY_MS = 60 * 1000;

// Rule 15: shown in both windows (Admin and Cashier, also on Login) while the
// computer's clock looks wrong. Selling is still allowed — this only warns.
export default function ClockWarningBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    const check = () =>
      window.api?.app
        ?.getClockStatus?.()
        .then((res) => alive && setStatus(res))
        .catch(() => {});
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    window.addEventListener(SALE_COMPLETED_EVENT, check);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener(SALE_COMPLETED_EVENT, check);
    };
  }, []);

  if (!status || status.ok !== false) return null;
  return (
    <div role="alert" style={styles.bar}>
      <Clock size={16} aria-hidden="true" />
      <span>{status.message || "The computer's date/time looks wrong - fix it before selling."}</span>
    </div>
  );
}

const styles = {
  // Fixed along the bottom, clear of the Dev Panel corner (bottom-right 64px).
  bar: {
    position: 'fixed',
    left: '16px',
    right: '80px',
    bottom: '12px',
    zIndex: 4000,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: '10px 14px',
    borderRadius: theme.radius.md,
    backgroundColor: c.red,
    color: c.labelOnAccent,
    ...theme.type.subhead,
    fontWeight: theme.font.weightSemibold,
    boxShadow: theme.shadow.popover,
  },
};
