import { addDays, startOfMonth, startOfWeek, toIsoDate } from './date-utils';

/** Inclusive date range as ISO dates (YYYY-MM-DD, local). */
export interface DateRange {
  from: string;
  to: string;
}

export type RangeMode = 'range' | 'week';

export interface RangePreset {
  id: string;
  label: string;
  range: (today: Date) => DateRange;
}

/** Parses YYYY-MM-DD as local midnight (not UTC like `new Date(iso)`). */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function range(from: Date, to: Date): DateRange {
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function weekOf(d: Date, offsetWeeks = 0): DateRange {
  const start = addDays(startOfWeek(d), offsetWeeks * 7);
  return range(start, addDays(start, 6));
}

function monthOf(d: Date, offsetMonths = 0): DateRange {
  const start = new Date(d.getFullYear(), d.getMonth() + offsetMonths, 1);
  return range(start, new Date(start.getFullYear(), start.getMonth() + 1, 0));
}

function quarterOf(d: Date, offsetQuarters = 0): DateRange {
  const q = Math.floor(d.getMonth() / 3) + offsetQuarters;
  const start = new Date(d.getFullYear(), q * 3, 1);
  return range(start, new Date(start.getFullYear(), start.getMonth() + 3, 0));
}

function yearOf(d: Date, offsetYears = 0): DateRange {
  const y = d.getFullYear() + offsetYears;
  return range(new Date(y, 0, 1), new Date(y, 11, 31));
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: 'today', label: 'Heute', range: (t) => range(t, t) },
  { id: 'yesterday', label: 'Gestern', range: (t) => range(addDays(t, -1), addDays(t, -1)) },
  { id: 'this-week', label: 'Diese Woche', range: (t) => weekOf(t) },
  { id: 'last-week', label: 'Letzte Woche', range: (t) => weekOf(t, -1) },
  { id: 'last-2-weeks', label: 'Letzte 2 Wochen', range: (t) => range(startOfWeek(addDays(t, -7)), addDays(startOfWeek(t), 6)) },
  { id: 'last-30-days', label: 'Letzte 30 Tage', range: (t) => range(addDays(t, -29), t) },
  { id: 'this-month', label: 'Dieser Monat', range: (t) => monthOf(t) },
  { id: 'last-month', label: 'Letzter Monat', range: (t) => monthOf(t, -1) },
  { id: 'this-quarter', label: 'Dieses Quartal', range: (t) => quarterOf(t) },
  { id: 'last-quarter', label: 'Letztes Quartal', range: (t) => quarterOf(t, -1) },
  { id: 'this-year', label: 'Dieses Jahr', range: (t) => yearOf(t) },
  { id: 'last-year', label: 'Letztes Jahr', range: (t) => yearOf(t, -1) },
];

/** Week-based views (timesheet, calendar) always show exactly one Mon–Sun week. */
export const WEEK_PRESETS: RangePreset[] = [
  { id: 'this-week', label: 'Diese Woche', range: (t) => weekOf(t) },
  { id: 'last-week', label: 'Letzte Woche', range: (t) => weekOf(t, -1) },
  { id: 'next-week', label: 'Nächste Woche', range: (t) => weekOf(t, 1) },
];

export function presetsFor(mode: RangeMode): RangePreset[] {
  return mode === 'week' ? WEEK_PRESETS : RANGE_PRESETS;
}

export function matchPreset(r: DateRange, presets: RangePreset[], today = new Date()): RangePreset | null {
  return presets.find((p) => {
    const pr = p.range(today);
    return pr.from === r.from && pr.to === r.to;
  }) ?? null;
}

/** Mon–Sun week containing the given ISO date. */
export function weekRange(iso: string): DateRange {
  return weekOf(parseIsoDate(iso));
}

function isMonthAligned(r: DateRange): boolean {
  const from = parseIsoDate(r.from);
  const to = parseIsoDate(r.to);
  return from.getDate() === 1 && addDays(to, 1).getDate() === 1;
}

/**
 * Moves the range one "period" forward or back. Whole months/quarters/years keep
 * their calendar alignment (Jan → Feb, not +31 days); any other range shifts by
 * its own length, so a week stays a week and a single day a day.
 */
export function shiftRange(r: DateRange, direction: 1 | -1): DateRange {
  const from = parseIsoDate(r.from);
  const to = parseIsoDate(r.to);
  if (isMonthAligned(r)) {
    const months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth() + 1;
    const start = new Date(from.getFullYear(), from.getMonth() + direction * months, 1);
    return range(start, new Date(start.getFullYear(), start.getMonth() + months, 0));
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return range(addDays(from, direction * days), addDays(to, direction * days));
}

/** ISO 8601 calendar week number. */
export function isoWeek(d: Date): number {
  // UTC arithmetic avoids DST-shortened days; the week belongs to the year of its Thursday.
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

const DM = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit' });
const DMY = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** "05.10.2026" for one day, "28.09. – 04.10.2026" within a year, full dates otherwise. */
export function formatRange(r: DateRange): string {
  const from = parseIsoDate(r.from);
  const to = parseIsoDate(r.to);
  if (r.from === r.to) {
    return DMY.format(from);
  }
  const left = from.getFullYear() === to.getFullYear() ? DM.format(from) : DMY.format(from);
  return `${left} – ${DMY.format(to)}`;
}

/** 42 days (6 rows × Mon–Sun) covering the month that contains `month`. */
export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
