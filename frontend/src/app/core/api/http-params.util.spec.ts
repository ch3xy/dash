import { toParams } from './http-params.util';

describe('toParams', () => {
  it('skips null, undefined and empty-string values', () => {
    const p = toParams({ a: 1, b: null, c: undefined, d: '', e: 'x' });
    expect(p.keys().sort()).toEqual(['a', 'e']);
    expect(p.get('a')).toBe('1');
    expect(p.get('e')).toBe('x');
  });

  it('appends array values as repeated params', () => {
    const p = toParams({ tagId: ['a', 'b'] });
    expect(p.getAll('tagId')).toEqual(['a', 'b']);
  });

  it('returns empty params for undefined input', () => {
    expect(toParams(undefined).keys()).toEqual([]);
  });

  it('keeps boolean and zero values', () => {
    const p = toParams({ billable: false, n: 0 });
    expect(p.get('billable')).toBe('false');
    expect(p.get('n')).toBe('0');
  });
});
