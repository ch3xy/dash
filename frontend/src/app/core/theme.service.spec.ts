import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    try {
      globalThis.localStorage?.clear();
    } catch {
      /* ignore */
    }
  });

  it('initialises without throwing when storage/matchMedia behave', () => {
    const svc = new ThemeService();
    expect(['light', 'dark']).toContain(svc.theme());
  });

  it('toggles between light and dark', () => {
    const svc = new ThemeService();
    const first = svc.theme();
    svc.toggle();
    expect(svc.theme()).not.toBe(first);
    svc.toggle();
    expect(svc.theme()).toBe(first);
  });

  it('persists the toggled theme to localStorage when available', () => {
    const svc = new ThemeService();
    svc.toggle();
    if (globalThis.localStorage) {
      expect(globalThis.localStorage.getItem('dash-theme')).toBe(svc.theme());
    }
  });
});
