import { DailyProjectSegment } from '../../core/models';
import { autoGranularity, bucketDays, bucketLabel, ChartDay, granularityAllowed, labelVisible } from './chart-buckets';
import { addDays, isoWeek, toIsoDate } from './date-utils';

/** Fully billable at 10/h. */
function seg(projectId: string, durationSeconds: number): DailyProjectSegment {
  return {
    date: '', projectId, projectName: projectId, projectColor: null, durationSeconds,
    billableSeconds: durationSeconds, revenueAmount: String(durationSeconds / 360),
  };
}

/** Consecutive days from `from`, each with 1h on project "a". */
function days(from: string, count: number): ChartDay[] {
  const start = new Date(from + 'T12:00:00');
  return Array.from({ length: count }, (_, i) => ({
    date: toIsoDate(addDays(start, i)),
    totalSeconds: 3600,
    projects: [seg('a', 3600)],
    forecastSeconds: 0,
    forecastProjects: [],
  }));
}

describe('chart-buckets', () => {
  it('picks day, week and month by range length', () => {
    expect(autoGranularity(31)).toBe('day');
    expect(autoGranularity(32)).toBe('week');
    expect(autoGranularity(120)).toBe('week');
    expect(autoGranularity(365)).toBe('month');
  });

  it('disallows daily bars for a whole year', () => {
    expect(granularityAllowed('day', 365)).toBe(false);
    expect(granularityAllowed('week', 365)).toBe(true);
    expect(granularityAllowed('month', 365)).toBe(true);
  });

  it('aggregates a year into 12 full months', () => {
    const buckets = bucketDays(days('2026-01-01', 365), 'month');
    expect(buckets).toHaveLength(12);
    expect(buckets[1]).toMatchObject({ key: '2026-02', totalSeconds: 28 * 3600, partial: false, workdays: 20 });
    expect(buckets[1].projects).toEqual([seg('a', 28 * 3600)]);
  });

  it('marks months cut by the range as partial', () => {
    const buckets = bucketDays(days('2026-10-20', 30), 'month');
    expect(buckets.map((b) => b.key)).toEqual(['2026-10', '2026-11']);
    expect(buckets[0]).toMatchObject({ partial: true, firstDay: '2026-10-20', periodFrom: '2026-10-01' });
    expect(bucketLabel(buckets[0], 'month', 2, false)).toBe('Okt (ab 20.)');
    expect(bucketLabel(buckets[1], 'month', 2, false)).toBe('Nov (bis 18.)');
  });

  it('groups weeks from Monday to Sunday', () => {
    // 2026-10-21 is a Wednesday.
    const buckets = bucketDays(days('2026-10-21', 12), 'week');
    expect(buckets.map((b) => b.key)).toEqual(['2026-10-19', '2026-10-26']);
    expect(buckets[0].totalSeconds).toBe(5 * 3600);
    expect(bucketLabel(buckets[0], 'week', 2, false)).toBe('KW 43');
  });

  it('thins out week labels for a whole year', () => {
    const weeks = bucketDays(days('2026-01-01', 365), 'week');
    const shown = weeks.filter((b, i) => labelVisible(b, i, 'week', weeks.length));
    expect(weeks.length).toBe(53);
    // Every 4th week, but not the last one (index 52) at the chart edge.
    expect(shown.length).toBe(13);
    // Few bars keep every label.
    const short = bucketDays(days('2026-10-19', 14), 'week');
    expect(short.every((b, i) => labelVisible(b, i, 'week', short.length))).toBe(true);
  });

  it('labels only Mondays when daily bars get dense', () => {
    const daily = bucketDays(days('2026-10-19', 60), 'day');
    const shown = daily.filter((b, i) => labelVisible(b, i, 'day', daily.length));
    expect(shown.map((b) => b.key).slice(0, 2)).toEqual(['2026-10-19', '2026-10-26']);
    expect(bucketLabel(shown[0], 'day', daily.length, false)).toBe('19.10.');
  });

  it('keeps forecast seconds separate from actuals', () => {
    const input = days('2026-10-01', 2);
    input[1] = { ...input[1], totalSeconds: 0, projects: [], forecastSeconds: 7200, forecastProjects: [seg('a', 7200)] };
    const [month] = bucketDays(input, 'month');
    expect(month.totalSeconds).toBe(3600);
    expect(month.forecastSeconds).toBe(7200);
    expect(month.forecastProjects).toEqual([seg('a', 7200)]);
  });

  it('sums billable time and revenue per project across the bucket', () => {
    const [week] = bucketDays(days('2026-10-05', 3), 'week');
    expect(week.projects).toEqual([seg('a', 3 * 3600)]);
  });

  it('keeps unrounded forecast revenue so the bucket total does not drift by cents', () => {
    // 1 billable minute at 100/h per day: 1.666… each, exactly 5.00 for the three days.
    const input = days('2026-10-05', 3).map((d) => ({
      ...d,
      forecastSeconds: 60,
      forecastProjects: [{ ...seg('a', 60), revenueAmount: '1.6666666667' }],
    }));
    const [week] = bucketDays(input, 'week');
    expect(Number(week.forecastProjects[0].revenueAmount).toFixed(2)).toBe('5.00');
  });

  it('computes ISO week numbers across year boundaries', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
    expect(isoWeek(new Date(2026, 11, 28))).toBe(53);
  });
});
