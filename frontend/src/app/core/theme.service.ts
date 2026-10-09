import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
/** User preference; 'system' follows the OS color scheme live. */
export type ThemeMode = Theme | 'system';

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Hell',
  dark: 'Dunkel',
  system: 'System',
};

const KEY = 'dash-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.readMode());
  /** Effective theme after resolving 'system'. */
  readonly theme = signal<Theme>(this.resolve(this.mode()));

  constructor() {
    this.media()?.addEventListener?.('change', () => {
      if (this.mode() === 'system') {
        this.theme.set(this.resolve('system'));
        this.apply();
      }
    });
  }

  private readMode(): ThemeMode {
    try {
      const stored = globalThis.localStorage?.getItem(KEY);
      return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  private media(): MediaQueryList | null {
    try {
      return globalThis.matchMedia?.(DARK_QUERY) ?? null;
    } catch {
      return null;
    }
  }

  private resolve(mode: ThemeMode): Theme {
    if (mode !== 'system') {
      return mode;
    }
    return this.media()?.matches ? 'dark' : 'light';
  }

  apply(): void {
    globalThis.document?.documentElement.setAttribute('data-theme', this.theme());
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.theme.set(this.resolve(mode));
    try {
      globalThis.localStorage?.setItem(KEY, mode);
    } catch {
      /* storage unavailable — keep in-memory theme only */
    }
    this.apply();
  }

  /** Topbar quick switch: pins the opposite of what is currently shown. */
  toggle(): void {
    this.setMode(this.theme() === 'dark' ? 'light' : 'dark');
  }
}
