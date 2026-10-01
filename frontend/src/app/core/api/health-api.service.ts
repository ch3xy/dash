import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

interface Health {
  status: string;
  version: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class HealthApiService {
  private readonly http = inject(HttpClient);

  /** App version from the backend build info; `null` when the backend is unreachable. */
  version(): Observable<string | null> {
    return this.http.get<Health>('/health').pipe(
      map((h) => h.version),
      catchError(() => of(null)),
    );
  }
}
