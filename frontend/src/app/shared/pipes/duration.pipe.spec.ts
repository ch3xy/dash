import { DurationPipe } from './duration.pipe';

describe('DurationPipe', () => {
  const pipe = new DurationPipe();

  it('formats HH:MM:SS by default', () => {
    expect(pipe.transform(3661)).toBe('1:01:01');
  });

  it('formats HH:MM', () => {
    expect(pipe.transform(7200, 'HH:MM')).toBe('2:00');
    expect(pipe.transform(3661, 'HH:MM')).toBe('1:01');
  });

  it('formats decimal hours', () => {
    expect(pipe.transform(5400, 'decimal')).toBe('1.50');
  });

  it('formats compact', () => {
    expect(pipe.transform(3661, 'compact')).toBe('1h 01m');
    expect(pipe.transform(600, 'compact')).toBe('10m');
  });

  it('renders placeholder for null', () => {
    expect(pipe.transform(null)).toBe('--:--');
  });

  it('clamps negatives to zero', () => {
    expect(pipe.transform(-100, 'HH:MM')).toBe('0:00');
  });
});
