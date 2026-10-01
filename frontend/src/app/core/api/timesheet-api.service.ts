import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { IsoDate, TimeEntry, Uuid } from '../models';

@Injectable({ providedIn: 'root' })
export class TimesheetApiService {
  private readonly http = inject(HttpClient);

  /** Sets the total of one project/task cell on a day; the backend appends or trims entries. */
  setCell(input: { projectId: Uuid; taskId: Uuid | null; date: IsoDate; durationSeconds: number }): Observable<void> {
    return this.http.put<void>('/timesheet/cell', input);
  }

  copyWeek(source: IsoDate, target: IsoDate): Observable<TimeEntry[]> {
    return this.http.post<TimeEntry[]>('/timesheet/copy-week', { source, target });
  }
}
