import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';

const POLL_MS = 3000;

/** Status codes meaning "backend not reachable": no connection, or Caddy's maintenance response. */
export function isUnreachable(err: HttpErrorResponse): boolean {
  return err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504;
}

/**
 * Detects backend outages (restart/deploy, Pi offline). A failed request only triggers a health check;
 * `down` is set when that check fails too, so a single network blip does not cover the app.
 * While down the health endpoint is polled; once it answers the page is reloaded, which also picks up
 * a new frontend build after a deploy.
 */
@Injectable({ providedIn: 'root' })
export class ServerStatusService {
  private readonly http = inject(HttpClient);
  private checking = false;

  readonly down = signal(false);

  /** A request failed as if the backend were unreachable: verify right away (one check at a time). */
  suspectDown(): void {
    if (this.down() || this.checking) {
      return;
    }
    this.checking = true;
    this.probe((reachable) => {
      this.checking = false;
      if (!reachable) {
        this.down.set(true);
        this.schedulePoll();
      }
    });
  }

  /** Overridable in tests. */
  reloadPage(): void {
    location.reload();
  }

  private schedulePoll(): void {
    setTimeout(() => this.probe((reachable) => (reachable ? this.reloadPage() : this.schedulePoll())), POLL_MS);
  }

  private probe(done: (reachable: boolean) => void): void {
    this.http.get('/health').subscribe({
      next: () => done(true),
      error: (err: HttpErrorResponse) => done(!isUnreachable(err)),
    });
  }
}
