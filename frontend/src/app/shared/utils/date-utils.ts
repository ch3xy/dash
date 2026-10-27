/** Date helpers operating on local time, producing ISO strings for the API. */

/** YYYY-MM-DD for a Date in local time. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toIsoDate(new Date());
}

/** Monday of the week containing the given date (ISO week start). */
export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Combine an ISO date (YYYY-MM-DD) and HH:MM time into a UTC ISO instant. */
export function toInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

/**
 * Start/end instants from dialog fields. `date` is the start day; an end time before the
 * start time lies on the next day (22:00–01:00). A field whose day and HH:MM still match
 * `original` keeps the original instant, so seconds survive an unchanged save.
 * Returns null if a field is empty.
 */
export function intervalFromFields(
  date: string,
  start: string,
  end: string,
  original?: { startTime: string; endTime: string },
): { startTime: string; endTime: string } | null {
  if (!date || !start || !end) return null;
  const endDate = end < start ? toIsoDate(addDays(new Date(`${date}T12:00:00`), 1)) : date;
  const keep = (iso: string | undefined, d: string, t: string) =>
    iso && toIsoDate(new Date(iso)) === d && timeOf(iso) === t ? iso : toInstant(d, t);
  return {
    startTime: keep(original?.startTime, date, start),
    endTime: keep(original?.endTime, endDate, end),
  };
}

/** Extract HH:MM (local) from an ISO instant. */
export function timeOf(instant: string): string {
  const d = new Date(instant);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

/** ISO-8601 calendar week number (weeks start on Monday, week 1 contains Jan 4). */
export function isoWeek(d: Date): number {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // Thursday of the current week decides the week's year.
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const jan4 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}
