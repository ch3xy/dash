import { parseDuration } from './timesheet.component';

describe('parseDuration', () => {
  it('parses h:mm', () => {
    expect(parseDuration('1:30')).toBe(5400);
    expect(parseDuration('0:05')).toBe(300);
  });

  it('parses decimal hours with comma or dot', () => {
    expect(parseDuration('1,5')).toBe(5400);
    expect(parseDuration('2.25')).toBe(8100);
    expect(parseDuration('3h')).toBe(10800);
  });

  it('parses minutes', () => {
    expect(parseDuration('90m')).toBe(5400);
  });

  it('treats empty input as zero', () => {
    expect(parseDuration('')).toBe(0);
    expect(parseDuration('  ')).toBe(0);
  });

  it('rejects garbage', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('1:75')).toBeNull();
    expect(parseDuration('-1')).toBeNull();
  });
});
