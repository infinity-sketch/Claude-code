// Date helpers. All calendar dates are local "YYYY-MM-DD" strings so a post planned
// for Tuesday stays on Tuesday regardless of time zone.

const pad = n => String(n).padStart(2, '0');

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(fromISO, toISO_) {
  const ms = parseISO(toISO_) - parseISO(fromISO);
  return Math.round(ms / 86400000);
}

// Monday-based week start.
export function startOfWeek(iso) {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7;
  return addDays(iso, -dow);
}

export function rangeDays(startIso, count) {
  return Array.from({ length: count }, (_, i) => addDays(startIso, i));
}

// 6x7 grid of ISO dates covering the month containing `iso` (Monday first).
export function monthGrid(iso) {
  const d = parseISO(iso);
  const first = toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  return rangeDays(startOfWeek(first), 42);
}

export function sameMonth(a, b) {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function addMonths(iso, n) {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmtDay(iso) {
  const d = parseISO(iso);
  return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}
export function fmtShort(iso) {
  const d = parseISO(iso);
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}
export function fmtDow(iso) {
  return DOW[parseISO(iso).getDay()];
}
export function fmtMonth(iso) {
  const d = parseISO(iso);
  return `${MONTH_FULL[d.getMonth()]} ${d.getFullYear()}`;
}
export function dayNum(iso) {
  return parseISO(iso).getDate();
}

export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${pad(m)}${suffix}` : `${h12}${suffix}`;
}
