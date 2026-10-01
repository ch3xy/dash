import {
  formatRange,
  isoWeek,
  matchPreset,
  monthGrid,
  parseIsoDate,
  RANGE_PRESETS,
  shiftRange,
  WEEK_PRESETS,
  weekRange,
} from './date-range';

// Wednesday, 2026-10-07
const TODAY = new Date(2026, 9, 7);
const preset = (id: string) => RANGE_PRESETS.find((p) => p.id === id)!.range(TODAY);

describe('date-range presets', () => {
  it('computes day presets', () => {
    expect(preset('today')).toEqual({ from: '2026-10-07', to: '2026-10-07' });
    expect(preset('yesterday')).toEqual({ from: '2026-10-06', to: '2026-10-06' });
  });

  it('computes Monday-based week presets', () => {
    expect(preset('this-week')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(preset('last-week')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(preset('last-2-weeks')).toEqual({ from: '2026-09-28', to: '2026-10-11' });
  });

  it('computes month, quarter and year presets', () => {
    expect(preset('this-month')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(preset('last-month')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(preset('this-quarter')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(preset('last-quarter')).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(preset('this-year')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(preset('last-year')).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });

  it('handles January for last month', () => {
    const jan = RANGE_PRESETS.find((p) => p.id === 'last-month')!.range(new Date(2026, 0, 15));
    expect(jan).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });

  it('matches a range to its preset', () => {
    expect(matchPreset({ from: '2026-10-05', to: '2026-10-11' }, RANGE_PRESETS, TODAY)?.label).toBe('Diese Woche');
    expect(matchPreset({ from: '2026-10-05', to: '2026-10-10' }, RANGE_PRESETS, TODAY)).toBeNull();
    expect(matchPreset({ from: '2026-10-12', to: '2026-10-18' }, WEEK_PRESETS, TODAY)?.label).toBe('Nächste Woche');
  });
});

describe('shiftRange', () => {
  it('shifts weeks and days by their length', () => {
    expect(shiftRange({ from: '2026-10-05', to: '2026-10-11' }, 1)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(shiftRange({ from: '2026-10-07', to: '2026-10-07' }, -1)).toEqual({ from: '2026-10-06', to: '2026-10-06' });
  });

  it('keeps calendar alignment for months, quarters and years', () => {
    expect(shiftRange({ from: '2026-01-01', to: '2026-01-31' }, 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(shiftRange({ from: '2026-10-01', to: '2026-12-31' }, 1)).toEqual({ from: '2027-01-01', to: '2027-03-31' });
    expect(shiftRange({ from: '2026-01-01', to: '2026-12-31' }, -1)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });

  it('shifts across the DST change without drifting', () => {
    expect(shiftRange({ from: '2026-10-19', to: '2026-10-25' }, 1)).toEqual({ from: '2026-10-26', to: '2026-11-01' });
  });
});

describe('helpers', () => {
  it('computes ISO week numbers incl. year boundaries', () => {
    expect(isoWeek(new Date(2026, 9, 7))).toBe(41);
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
  });

  it('returns the Mon–Sun week of a date', () => {
    expect(weekRange('2026-10-11')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('formats ranges compactly', () => {
    expect(formatRange({ from: '2026-10-07', to: '2026-10-07' })).toBe('07.10.2026');
    expect(formatRange({ from: '2026-09-28', to: '2026-10-04' })).toBe('28.09. – 04.10.2026');
    expect(formatRange({ from: '2025-12-29', to: '2026-01-04' })).toBe('29.12.2025 – 04.01.2026');
  });

  it('builds a Monday-first 6-week month grid', () => {
    const grid = monthGrid(parseIsoDate('2026-10-15'));
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1);
    expect(grid[0].getDate()).toBe(28); // Mon 28.09.
  });
});
