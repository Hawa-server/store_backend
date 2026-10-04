/*
 * utils/dates.js
 *
 * Date helpers. The database stores UTC; anything shown to people or used for
 * business dates uses Ghana time (Africa/Accra).
 */
const BUSINESS_TIME_ZONE = 'Africa/Accra';

/*
 * formatGhanaDateTime(date)
 * Receives: a Date.
 * Returns: a readable string in Ghana time, e.g.
 *          "Tuesday, 29 September 2026 at 13:45 (Ghana time)".
 */
function formatGhanaDateTime(date) {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
  return `${formatted} (Ghana time)`;
}

/*
 * accraMidnightUtc(year, month, day)
 * Receives: a calendar date (month 1–12) meaning that day in Ghana.
 * Returns: the Date (UTC) of midnight at the START of that day in Africa/Accra.
 * How: start from midnight UTC, ask Intl what time that is in Accra, and
 * shift by the difference. Ghana is UTC+0 all year, so the shift is 0 today,
 * but using the time zone name keeps the code correct and the intent clear.
 */
function accraMidnightUtc(year, month, day) {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(guess)
      .map((p) => [p.type, Number(p.value)])
  );
  const accraWallClockAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offsetMs = accraWallClockAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

/*
 * accraDayRange(from, to)
 * Receives: optional dates as 'YYYY-MM-DD' strings, meaning days in Ghana.
 * Returns: { start, end } as UTC Dates for a database filter
 *          createdAt >= start AND createdAt < end. BOTH days are included:
 *          `end` is midnight at the start of the day AFTER `to`.
 *          A missing date gives null for that side.
 */
function accraDayRange(from, to) {
  const split = (d) => d.split('-').map(Number);
  let start = null;
  let end = null;
  if (from) start = accraMidnightUtc(...split(from));
  if (to) {
    const [y, m, d] = split(to);
    end = accraMidnightUtc(y, m, d + 1); // Date.UTC rolls 31 → next month correctly
  }
  return { start, end };
}

/*
 * accraToday()
 * Receives: nothing.
 * Returns: today's date in Ghana as 'YYYY-MM-DD' (e.g. '2026-10-02').
 */
function accraToday() {
  // 'en-CA' formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(new Date());
}

/*
 * accraDaysAgo(days)
 * Receives: a number of days.
 * Returns: the Ghana date that many days before today, as 'YYYY-MM-DD'
 *          (accraDaysAgo(0) is today; accraDaysAgo(6) is 6 days ago).
 */
function accraDaysAgo(days) {
  const [y, m, d] = accraToday().split('-').map(Number);
  // Date.UTC handles going back across months and years correctly.
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

module.exports = { BUSINESS_TIME_ZONE, formatGhanaDateTime, accraDayRange, accraToday, accraDaysAgo };
