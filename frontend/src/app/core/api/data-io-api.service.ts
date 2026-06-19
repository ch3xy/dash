import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface ClockifyImportResult {
  imported: number;
  skipped: number;
  errors?: string[];
}

export interface RestoreResult {
  clients: number;
  projects: number;
  projectRates: number;
  tasks: number;
  tags: number;
  timeEntries: number;
}

@Injectable({ providedIn: 'root' })
export class DataIoApiService {
  private readonly http = inject(HttpClient);

  /** Full JSON backup of all data. */
  backup(): Observable<unknown> {
    return this.http.get('/backup');
  }

  /** Replaces ALL data with the given backup document. Irreversible. */
  restore(document: unknown): Observable<RestoreResult> {
    return this.http.post<RestoreResult>('/backup/restore', document);
  }

  importClockify(csv: string): Observable<ClockifyImportResult> {
    return this.http.post<ClockifyImportResult>('/import/clockify', csv, {
      headers: { 'Content-Type': 'text/csv' },
    });
  }
}
