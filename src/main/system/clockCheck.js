// Rule 15: a wrong computer clock is a WARNING (selling is still allowed). The
// clock looks wrong when it is earlier than the newest saved sale/return/payment
// (5 minutes of slack for two PCs whose clocks differ a little), when the year is
// before 2026, or when it is more than 2 years past the newest saved record (or
// past 1 Jan 2026 on a shop with no records yet).
const MESSAGE = "The computer's date/time looks wrong - fix it before selling.";
const SLACK_MS = 5 * 60 * 1000;
const TWO_YEARS_MS = 2 * 365.25 * 24 * 3600 * 1000;
const FIRST_YEAR = 2026;

function parseUtc(text) {
  if (!text) return null;
  const t = Date.parse(String(text).replace(' ', 'T') + 'Z');
  return Number.isNaN(t) ? null : t;
}

function newestRecordTime(db) {
  const row = db
    .prepare(
      `SELECT MAX(t) AS t FROM (
         SELECT MAX(created_at) AS t FROM sales
         UNION ALL SELECT MAX(created_at) FROM sale_returns
         UNION ALL SELECT MAX(created_at) FROM payments
       )`
    )
    .get();
  return parseUtc(row && row.t);
}

function getClockStatus(db, now = Date.now()) {
  const newest = newestRecordTime(db);
  const year = new Date(now).getFullYear();
  let reason = null;
  if (year < FIRST_YEAR) reason = 'year_too_early';
  else if (newest && now < newest - SLACK_MS) reason = 'before_newest_sale';
  else if (now > Math.max(newest || 0, Date.UTC(FIRST_YEAR, 0, 1)) + TWO_YEARS_MS) reason = 'too_far_ahead';
  return {
    success: true,
    ok: !reason,
    reason,
    message: reason ? MESSAGE : null,
    now: new Date(now).toISOString(),
    newestRecord: newest ? new Date(newest).toISOString() : null,
  };
}

module.exports = { getClockStatus, MESSAGE };
