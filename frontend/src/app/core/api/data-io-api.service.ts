import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ClockifyImportResult {
  imported: number;
  skipped: number;
  errors?: string[];
}

@Injectable({ providedIn: 'root' })
export class DataIoApiService {
  private readonly http = inject(HttpClient);

  /** Full JSON backup of all data. */
  backup(): Observable<unknown> {
    return this.http.get('/backup');
  }

  importClockify(csv: string): Observable<ClockifyImportResult> {
    return this.http.post<ClockifyImportResult>('/import/clockify', csv, {
      headers: { 'Content-Type': 'text/csv' },
    });
  }
}
