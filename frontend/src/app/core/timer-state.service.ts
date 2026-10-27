import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
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
  /** Bumped on every start/stop/discard/patch; poll results from before a mutation are stale. */
  private mutations = 0;

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
    const issuedAt = this.mutations;
    this.api.getCurrent().subscribe({
      next: (t) => {
        if (issuedAt === this.mutations) {
          this._timer.set(t ?? null);
        }
      },
      // Keep the last known state: a transient error must not hide a running timer.
      error: () => undefined,
    });
  }

  start(input: TimerStartInput) {
    this.mutations++;
    return this.api.start(input).pipe(tap((t) => this.applyMutation(t)));
  }

  /** {@code description} (also '' to clear) is saved with the stopped entry. */
  stop(description?: string) {
    this.mutations++;
    return this.api.stop(description).pipe(tap((_entry: TimeEntry) => this.applyMutation(null)));
  }

  discard() {
    this.mutations++;
    return this.api.discard().pipe(tap(() => this.applyMutation(null)));
  }

  patch(patch: TimerPatch) {
    this.mutations++;
    return this.api.patch(patch).pipe(tap((t) => this.applyMutation(t)));
  }

  private applyMutation(t: RunningTimer | null): void {
    // Responses arriving after the request also invalidate polls started meanwhile.
    this.mutations++;
    this._timer.set(t);
  }
}
