import { useEffect, useState, useCallback } from 'react';
import theme from '../../../config/theme';

const c = theme.colors;

// Chart series colors — token names only (see theme.js).
export const SERIES_COLORS = { accent: c.accent, green: c.green, orange: c.orange, purple: c.purple, teal: c.teal };

const NARROW_QUERY = '(max-width: 899px)';

export function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

// Loads a report through the page's own fetcher. Keeps the last good data on
// screen while a new filter loads; `success: false` responses count as errors.
export function useReportData(fetcher, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(fetcher)
      .then((res) => {
        if (!alive) return;
        if (!res || res.success === false) {
          setError(res?.reason || "Couldn't load this report.");
        } else {
          setData(res);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || "Couldn't load this report.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { data, loading: loading && !data, refreshing: loading && !!data, error, retry };
}

// "YYYY-MM-DD" read as a local calendar day.
export function parseDay(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const shortDay = (key) => parseDay(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const longDay = (key) => parseDay(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

// P&L buckets: "YYYY-MM-DD" (day), "YYYY-Www" (week), "YYYY-MM" (month).
export function bucketLabel(key, unit) {
  if (!key) return '';
  if (unit === 'day') return shortDay(key);
  if (unit === 'week') {
    const [y, w] = String(key).split('-W');
    return `Week ${Number(w)}, ${y}`;
  }
  return parseDay(`${key}-01`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function compactNumber(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${+(v / 1_000).toFixed(1)}k`;
  return String(Math.round(v));
}

export const sumBy = (rows, key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
