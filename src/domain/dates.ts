/**
 * Calendar-date helpers. We store dates as local 'YYYY-MM-DD' strings and
 * month buckets as 'YYYY-MM' so a transaction's day and month never shift
 * with the user's timezone (the app targets Asia/Jakarta but works anywhere).
 */

/** Today's local calendar day as 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' -> 'YYYY-MM'. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Current local month bucket, 'YYYY-MM'. */
export function currentMonth(now: Date = new Date()): string {
  return monthOf(todayISO(now));
}

/** Shift a 'YYYY-MM' key by n months (negative = past). */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const base = new Date(y, m - 1 + n, 1);
  const yy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

/** The previous month key. */
export function prevMonth(month: string): string {
  return addMonths(month, -1);
}
