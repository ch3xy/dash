import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  IsoDate,
  PageResponse,
  RecentCombination,
  TimeEntry,
  TimeEntryInput,
  Uuid,
} from '../models';
import { toParams } from './http-params.util';

export interface TimeEntryQuery {
  from?: IsoDate;
  to?: IsoDate;
  clientId?: Uuid;
  projectId?: Uuid;
  taskId?: Uuid;
  tagId?: Uuid;
  billable?: boolean;
  q?: string;
  page?: number;
  size?: number;
  sort?: string;
}

@Injectable({ providedIn: 'root' })
export class TimeEntryApiService {
  private readonly http = inject(HttpClient);

  list(query?: TimeEntryQuery): Observable<PageResponse<TimeEntry>> {
    return this.http.get<PageResponse<TimeEntry>>('/time-entries', {
      params: toParams(query),
    });
  }

  get(id: Uuid): Observable<TimeEntry> {
    return this.http.get<TimeEntry>(`/time-entries/${id}`);
  }

  create(input: TimeEntryInput): Observable<TimeEntry> {
    return this.http.post<TimeEntry>('/time-entries', input);
  }

  createBulk(inputs: TimeEntryInput[]): Observable<TimeEntry[]> {
    return this.http.post<TimeEntry[]>('/time-entries/bulk', inputs);
  }

  update(id: Uuid, input: TimeEntryInput): Observable<TimeEntry> {
    return this.http.put<TimeEntry>(`/time-entries/${id}`, input);
  }

  delete(id: Uuid): Observable<void> {
    return this.http.delete<void>(`/time-entries/${id}`);
  }

  continue(id: Uuid): Observable<unknown> {
    return this.http.post(`/time-entries/${id}/continue`, {});
  }

  recentCombinations(limit = 5): Observable<RecentCombination[]> {
    return this.http.get<RecentCombination[]>('/time-entries/recent-combinations', {
      params: toParams({ limit }),
    });
  }
}
