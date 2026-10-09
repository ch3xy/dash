import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    try {
      globalThis.localStorage?.clear();
    } catch {
      /* ignore */
    }
  });

  it('defaults to system mode and resolves to light or dark', () => {
    const svc = new ThemeService();
    expect(svc.mode()).toBe('system');
    expect(['light', 'dark']).toContain(svc.theme());
  });

  it('pins explicit modes', () => {
    const svc = new ThemeService();
    svc.setMode('dark');
    expect(svc.theme()).toBe('dark');
    svc.setMode('light');
    expect(svc.theme()).toBe('light');
  });

  it('toggles between light and dark', () => {
    const svc = new ThemeService();
    const first = svc.theme();
    svc.toggle();
    expect(svc.theme()).not.toBe(first);
    svc.toggle();
    expect(svc.theme()).toBe(first);
  });

  it('persists the mode and restores it in a new instance', () => {
    const svc = new ThemeService();
    svc.setMode('dark');
    if (globalThis.localStorage) {
      expect(globalThis.localStorage.getItem('dash-theme')).toBe('dark');
      expect(new ThemeService().mode()).toBe('dark');
    }
  });
});
