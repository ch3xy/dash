import { MoneyPipe } from './money.pipe';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('formats a numeric amount as EUR by default', () => {
    // de-AT uses a non-breaking space and comma decimal separator.
    expect(pipe.transform(180)).toContain('180,00');
    expect(pipe.transform(180)).toContain('€');
  });

  it('accepts string amounts (BigDecimal-as-string from the API)', () => {
    expect(pipe.transform('90.00')).toContain('90,00');
  });

  it('renders a dash for null/empty/NaN', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform('')).toBe('—');
    expect(pipe.transform('abc')).toBe('—');
  });

  it('honours the currency code', () => {
    expect(pipe.transform(10, 'USD')).toContain('$');
  });
});
