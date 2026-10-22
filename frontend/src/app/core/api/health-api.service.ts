import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of } from 'rxjs';

/** Build information from `/health`, shown in the sidebar as `v<version> (Build <commit>)`. */
export interface BuildInfo {
  version: string;
  /** Short git commit of the build; `null` without git information. */
  commit: string | null;
  /** The build was made with uncommitted changes. */
  dirty: boolean;
  /** ISO timestamp of the build. */
  builtAt: string | null;
}

interface Health extends BuildInfo {
  status: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class HealthApiService {
  private readonly http = inject(HttpClient);

  /** Build information from the backend; `null` when the backend is unreachable. */
  buildInfo(): Observable<BuildInfo | null> {
    return this.http.get<Health>('/health').pipe(catchError(() => of(null)));
  }
}
