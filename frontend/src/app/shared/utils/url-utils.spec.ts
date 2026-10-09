import { websiteHref } from './url-utils';

describe('websiteHref', () => {
  it('prefixes https when no scheme is given', () => {
    expect(websiteHref('acme.com')).toBe('https://acme.com');
  });

  it('keeps an existing http(s) scheme', () => {
    expect(websiteHref('http://acme.com')).toBe('http://acme.com');
    expect(websiteHref('HTTPS://acme.com')).toBe('HTTPS://acme.com');
  });
});
