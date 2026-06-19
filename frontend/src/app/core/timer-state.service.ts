import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { RunningTimer, TimeEntry, TimerStartInput } from './models';
import { TimerApiService, TimerPatch } from './api/timer-api.service';

/**
 * Singleton holding the running-timer state. Polls the backend periodically
 * and ticks the local elapsed counter every second so the topbar stays live.
 */
@Injectable({ providedIn: 'root' })
export class TimerStateService {
  private readonly api = inject(TimerApiService);

  private readonly _timer = signal<RunningTimer | null>(null);
  private readonly _tick = signal(0);

  readonly timer = this._timer.asReadonly();
  readonly isRunning = computed(() => this._timer() !== null);

  /** Live elapsed seconds, recomputed each tick from the timer's startTime. */
  readonly elapsedSeconds = computed(() => {
    this._tick();
    const t = this._timer();
    if (!t) {
      return 0;
    }
    const startMs = new Date(t.startTime).getTime();
    return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  });

  constructor() {
    this.refresh();
    setInterval(() => this._tick.update((n) => n + 1), 1000);
    setInterval(() => this.refresh(), 15000);
  }

  refresh(): void {
    this.api
      .getCurrent()
      .pipe(catchError(() => of(null)))
      .subscribe((t) => this._timer.set(t ?? null));
  }

  start(input: TimerStartInput) {
    return this.api.start(input).pipe(tap((t) => this._timer.set(t)));
  }

  stop(description?: string) {
    return this.api.stop(description).pipe(
      tap((entry: TimeEntry) => {
        this._timer.set(null);
        return entry;
      }),
    );
  }

  discard() {
    return this.api.discard().pipe(tap(() => this._timer.set(null)));
  }

  patch(patch: TimerPatch) {
    return this.api.patch(patch).pipe(tap((t) => this._timer.set(t)));
  }
}
