import i18n from '../i18n';

/**
 * Returns the Monday of the week containing the given date.
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Formats a date as YYYY-MM-DD string in local time.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses a YYYY-MM-DD string as a local midnight Date.
 */
export function fromDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Returns true if two dates fall on the same calendar day (local time).
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Returns true if date is strictly before today (local time).
 */
export function isPastDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Formats a time as HH:MM from a Date (local time).
 */
export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Formats a date as "Wednesday, 18 March".
 */
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Formats a date as "Wed, Mar 18".
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString(i18n.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Returns the fractional hour [0,24) as a vertical position fraction [0,1].
 */
export function hourFraction(date: Date): number {
  return (date.getHours() * 60 + date.getMinutes()) / 1440;
}

/**
 * Adds `days` calendar days to a date.
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Formats a unix-ms timestamp as a human-readable string for cache display.
 */
export function formatCacheTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
