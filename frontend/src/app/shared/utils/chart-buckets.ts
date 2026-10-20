import { DailyProjectSegment, IsoDate } from '../../core/models';
import { addDays, isoWeek, startOfWeek, toIsoDate } from './date-utils';

/** Time axis resolution of the report bar chart. */
export type ChartGranularity = 'day' | 'week' | 'month';

/** Above this many bars a granularity is not offered (bars get unreadably thin). */
export const MAX_CHART_BARS = 100;

/** Above this many bars the chart switches to narrow columns and sparse axis labels. */
export const DENSE_CHART_BARS = 31;

/** A day of the chart input: actual segments plus forecast segments. */
export interface ChartDay {
  date: IsoDate;
  totalSeconds: number;
  projects: DailyProjectSegment[];
  forecastSeconds: number;
  forecastProjects: DailyProjectSegment[];
}

/** One bar: a day, a week (Mon–Sun) or a calendar month, aggregated from its days. */
export interface ChartBucket {
  key: string;
  /** Natural bounds of the period (full week/month), used for zooming in. */
  periodFrom: IsoDate;
  periodTo: IsoDate;
  /** First/last day of the period that lies inside the report range. */
  firstDay: IsoDate;
  lastDay: IsoDate;
  /** True when the report range cuts the period (bar covers fewer days). */
  partial: boolean;
  /** Mon–Fri days of the period inside the range, for the daily average. */
  workdays: number;
  totalSeconds: number;
  forecastSeconds: number;
  projects: DailyProjectSegment[];
  forecastProjects: DailyProjectSegment[];
}

/** Day up to a month, week up to about a quarter, month beyond. */
export function autoGranularity(dayCount: number): ChartGranularity {
  if (dayCount <= 31) return 'day';
  if (dayCount <= 120) return 'week';
  return 'month';
}

/** Whether the granularity keeps the bar count readable for the given range length. */
export function granularityAllowed(g: ChartGranularity, dayCount: number): boolean {
  const bars = g === 'day' ? dayCount : g === 'week' ? Math.ceil(dayCount / 7) + 1 : Math.ceil(dayCount / 28) + 1;
  return bars <= MAX_CHART_BARS;
}

/** Groups consecutive days (as returned by the daily breakdown) into bars. */
export function bucketDays(days: ChartDay[], g: ChartGranularity): ChartBucket[] {
  const buckets = new Map<string, { bucket: ChartBucket; actual: Map<string, DailyProjectSegment>; forecast: Map<string, DailyProjectSegment> }>();
  for (const day of days) {
    const date = parse(day.date);
    const [key, periodFrom, periodTo] = period(date, g);
    let b = buckets.get(key);
    if (!b) {
      b = {
        bucket: {
          key, periodFrom, periodTo, firstDay: day.date, lastDay: day.date, partial: false, workdays: 0,
          totalSeconds: 0, forecastSeconds: 0, projects: [], forecastProjects: [],
        },
        actual: new Map(),
        forecast: new Map(),
      };
      buckets.set(key, b);
    }
    b.bucket.lastDay = day.date;
    if (date.getDay() !== 0 && date.getDay() !== 6) b.bucket.workdays++;
    b.bucket.totalSeconds += day.totalSeconds;
    b.bucket.forecastSeconds += day.forecastSeconds;
    merge(b.actual, day.projects);
    merge(b.forecast, day.forecastProjects);
  }
  return [...buckets.values()].map(({ bucket, actual, forecast }) => ({
    ...bucket,
    partial: bucket.firstDay !== bucket.periodFrom || bucket.lastDay !== bucket.periodTo,
    projects: sorted(actual),
    forecastProjects: sorted(forecast),
  }));
}

/**
 * Whether the axis label of the bar at {@code index} is shown. Labels are wider
 * than a column once there are many bars, so only every n-th one is drawn
 * (daily bars: Mondays only) and may overflow into its unlabelled neighbours.
 */
export function labelVisible(b: ChartBucket, index: number, g: ChartGranularity, barCount: number): boolean {
  // The last column has no neighbour to overflow into; its label would widen the chart.
  if (barCount > DENSE_CHART_BARS && index === barCount - 1) return false;
  if (g === 'day') {
    return barCount <= DENSE_CHART_BARS || parse(b.firstDay).getDay() === 1;
  }
  const step = barCount <= 14 ? 1 : barCount <= DENSE_CHART_BARS ? 2 : 4;
  return index % step === 0;
}

/** Short axis label of a bar. */
export function bucketLabel(b: ChartBucket, g: ChartGranularity, barCount: number, multiYear: boolean): string {
  const first = parse(b.firstDay);
  switch (g) {
    case 'day': {
      if (barCount > DENSE_CHART_BARS) {
        // Only Mondays are labelled (see labelVisible), so the date has room.
        return first.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
      }
      if (barCount > 14) {
        // Only the day number; Mondays get a dot so weeks stay readable.
        return first.getDay() === 1 ? `·${first.getDate()}` : String(first.getDate());
      }
      return first.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
    }
    case 'week':
      return `KW ${isoWeek(first)}`;
    case 'month': {
      const month = first.toLocaleDateString('de-AT', { month: 'short' }).replace('.', '');
      const name = multiYear ? `${month} ${String(first.getFullYear()).slice(2)}` : month;
      if (!b.partial) return name;
      return b.firstDay !== b.periodFrom ? `${name} (ab ${first.getDate()}.)` : `${name} (bis ${parse(b.lastDay).getDate()}.)`;
    }
  }
}

/** Long period description for the tooltip. */
export function bucketTitle(b: ChartBucket, g: ChartGranularity): string {
  const first = parse(b.firstDay);
  const dm = (iso: IsoDate) => parse(iso).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' });
  switch (g) {
    case 'day':
      return first.toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    case 'week':
      return `KW ${isoWeek(first)} · ${dm(b.firstDay)}–${dm(b.lastDay)}`;
    case 'month': {
      const name = first.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });
      return b.partial ? `${name} · ${dm(b.firstDay)}–${dm(b.lastDay)}` : name;
    }
  }
}

function period(date: Date, g: ChartGranularity): [string, IsoDate, IsoDate] {
  switch (g) {
    case 'day': {
      const iso = toIsoDate(date);
      return [iso, iso, iso];
    }
    case 'week': {
      const monday = startOfWeek(date);
      return [toIsoDate(monday), toIsoDate(monday), toIsoDate(addDays(monday, 6))];
    }
    case 'month': {
      const from = new Date(date.getFullYear(), date.getMonth(), 1);
      const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return [toIsoDate(from).slice(0, 7), toIsoDate(from), toIsoDate(to)];
    }
  }
}

function merge(into: Map<string, DailyProjectSegment>, segs: DailyProjectSegment[]): void {
  for (const s of segs) {
    const existing = into.get(s.projectId);
    if (existing) existing.durationSeconds += s.durationSeconds;
    else into.set(s.projectId, { ...s });
  }
}

function sorted(segs: Map<string, DailyProjectSegment>): DailyProjectSegment[] {
  return [...segs.values()].sort((a, b) => b.durationSeconds - a.durationSeconds);
}

function parse(iso: IsoDate): Date {
  return new Date(iso + 'T12:00:00');
}
