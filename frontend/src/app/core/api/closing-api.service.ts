import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/** A closed month; `month` is formatted as yyyy-MM. */
export interface MonthLock {
  month: string;
  lockedAt: string;
  note: string | null;
}

export interface MonthClosing {
  month: string;
  locked: boolean;
  lockedAt: string | null;
  note: string | null;
  /** Open and fully in the past. */
  lockable: boolean;
  entryCount: number;
  totalSeconds: number;
  billableSeconds: number;
  revenue: number;
  currency: string;
}

@Injectable({ providedIn: 'root' })
export class ClosingApiService {
  private readonly http = inject(HttpClient);

  months(): Observable<MonthClosing[]> {
    return this.http.get<MonthClosing[]>('/closing/months');
  }

  locks(): Observable<MonthLock[]> {
    return this.http.get<MonthLock[]>('/closing/locks');
  }

  lock(month: string, note?: string): Observable<MonthLock> {
    return this.http.post<MonthLock>(`/closing/months/${month}/lock`, { note: note || null });
  }

  unlock(month: string): Observable<void> {
    return this.http.delete<void>(`/closing/months/${month}/lock`);
  }
}
