import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { ClosingApiService, MonthLock } from './api/closing-api.service';

const MONTH_NAMES = [
  'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** "2026-09" → "September 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Shared set of closed months (Monatsabschluss), so views can render entries of
 * closed months read-only. The backend enforces the lock; this is only for the UI.
 */
@Injectable({ providedIn: 'root' })
export class MonthLockStateService {
  private readonly api = inject(ClosingApiService);
  private readonly _locks = signal<MonthLock[]>([]);

  readonly locks = this._locks.asReadonly();
  private readonly lockedMonths = computed(() => new Set(this._locks().map((l) => l.month)));

  constructor() {
    this.refresh().subscribe();
  }

  refresh(): Observable<MonthLock[]> {
    return this.api.locks().pipe(
      catchError(() => of([] as MonthLock[])),
      tap((locks) => this._locks.set(locks)),
    );
  }

  /** True if the month of the given ISO date (yyyy-MM-dd or yyyy-MM…) is closed. */
  isLocked(isoDate: string | null | undefined): boolean {
    return !!isoDate && this.lockedMonths().has(isoDate.slice(0, 7));
  }

  /** True if any day in [from, to] (ISO dates) lies in a closed month. */
  anyLocked(from: string, to: string): boolean {
    return this.isLocked(from) || this.isLocked(to);
  }
}
