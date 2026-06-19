import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
const KEY = 'dash-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.initial());

  private initial(): Theme {
    const stored = this.read();
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return this.prefersDark() ? 'dark' : 'light';
  }

  private read(): string | null {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }

  private prefersDark(): boolean {
    try {
      return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  }

  apply(): void {
    globalThis.document?.documentElement.setAttribute('data-theme', this.theme());
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
    try {
      globalThis.localStorage?.setItem(KEY, this.theme());
    } catch {
      /* storage unavailable — keep in-memory theme only */
    }
    this.apply();
  }
}
