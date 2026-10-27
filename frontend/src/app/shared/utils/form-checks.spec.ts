import { currencyError, nonNegativeError, positiveError } from './form-checks';

describe('form-checks', () => {
  it('checks currency codes', () => {
    expect(currencyError('EUR')).toBeNull();
    expect(currencyError('chf')).toBeNull();
    expect(currencyError('EU')).not.toBeNull();
    expect(currencyError('')).not.toBeNull();
    expect(currencyError('', true)).toBeNull();
  });

  it('checks number ranges', () => {
    expect(nonNegativeError(0)).toBeNull();
    expect(nonNegativeError(null)).toBeNull();
    expect(nonNegativeError(-1)).not.toBeNull();
    expect(positiveError(0)).not.toBeNull();
    expect(positiveError(0.5)).toBeNull();
    expect(nonNegativeError('-5.00')).not.toBeNull();
    expect(nonNegativeError('')).toBeNull();
  });
});
