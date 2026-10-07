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

/** Criteria for bulk deletion; set fields are AND-combined, at least one is required. */
export interface DeleteCriteria {
  from?: IsoDate;
  to?: IsoDate;
  clientId?: Uuid;
  projectId?: Uuid;
}

export interface DeletePreview {
  count: number;
  totalSeconds: number;
  /** Entries in closed months; deletion is rejected while this is > 0. */
  lockedCount: number;
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

  deleteBulk(ids: Uuid[]): Observable<void> {
    return this.http.post<void>('/time-entries/bulk-delete', { ids });
  }

  deletePreview(criteria: DeleteCriteria): Observable<DeletePreview> {
    return this.http.get<DeletePreview>('/time-entries/delete-preview', {
      params: toParams(criteria),
    });
  }

  deleteByCriteria(criteria: DeleteCriteria, expectedCount: number): Observable<{ deleted: number }> {
    return this.http.post<{ deleted: number }>('/time-entries/delete-by-criteria', {
      ...criteria,
      expectedCount,
    });
  }

  updateBulk(input: {
    ids: Uuid[];
    billable?: boolean;
    addTagIds?: Uuid[];
    removeTagIds?: Uuid[];
  }): Observable<TimeEntry[]> {
    return this.http.post<TimeEntry[]>('/time-entries/bulk-update', input);
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

  split(id: Uuid, splitAt: string): Observable<TimeEntry[]> {
    return this.http.post<TimeEntry[]>(`/time-entries/${id}/split`, { splitAt });
  }

  recentCombinations(limit = 5): Observable<RecentCombination[]> {
    return this.http.get<RecentCombination[]>('/time-entries/recent-combinations', {
      params: toParams({ limit }),
    });
  }
}
