import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RunningTimer, TimeEntry, TimerStartInput, Uuid } from '../models';

export interface TimerPatch {
  projectId?: Uuid | null;
  taskId?: Uuid | null;
  description?: string | null;
  billable?: boolean;
  tagIds?: Uuid[];
}

@Injectable({ providedIn: 'root' })
export class TimerApiService {
  private readonly http = inject(HttpClient);

  /** Returns the running timer, or null on 404 (no timer running). */
  getCurrent(): Observable<RunningTimer | null> {
    return this.http.get<RunningTimer | null>('/timer/current');
  }

  start(input: TimerStartInput): Observable<RunningTimer> {
    return this.http.post<RunningTimer>('/timer/start', input);
  }

  stop(description?: string): Observable<TimeEntry> {
    return this.http.post<TimeEntry>('/timer/stop', description ? { description } : {});
  }

  discard(): Observable<void> {
    return this.http.post<void>('/timer/discard', {});
  }

  patch(patch: TimerPatch): Observable<RunningTimer> {
    return this.http.patch<RunningTimer>('/timer/current', patch);
  }
}
