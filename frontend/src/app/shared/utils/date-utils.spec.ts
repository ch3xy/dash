import { addDays, startOfWeek, timeOf, toInstant, toIsoDate } from './date-utils';

describe('date-utils', () => {
  it('toIsoDate formats local Y-M-D zero-padded', () => {
    expect(toIsoDate(new Date(2026, 5, 9))).toBe('2026-06-09');
  });

  it('startOfWeek returns the Monday of the week', () => {
    // 2026-06-19 is a Friday → Monday is 2026-06-15.
    expect(toIsoDate(startOfWeek(new Date(2026, 5, 19)))).toBe('2026-06-15');
    // A Sunday belongs to the week that started the previous Monday.
    expect(toIsoDate(startOfWeek(new Date(2026, 5, 21)))).toBe('2026-06-15');
  });

  it('addDays shifts by the given offset', () => {
    expect(toIsoDate(addDays(new Date(2026, 5, 19), 6))).toBe('2026-06-25');
    expect(toIsoDate(addDays(new Date(2026, 5, 1), -1))).toBe('2026-05-31');
  });

  it('toInstant and timeOf round-trip a local time', () => {
    const instant = toInstant('2026-06-19', '14:30');
    expect(timeOf(instant)).toBe('14:30');
  });
});
