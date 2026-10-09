import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ServerStatusService } from '../server-status.service';

/**
 * Full-screen notice while the backend is unreachable. Same card as the proxy maintenance page
 * (pi-ops: stacks/apps/proxy/maintenance) so outages look identical in all Arrow apps.
 */
@Component({
  selector: 'app-server-down',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status.down()) {
      <div class="server-down">
        <main class="server-down-card">
          <div class="brand">
            <svg viewBox="4 14 48 44" aria-hidden="true">
              <circle cx="28" cy="36" r="22" fill="none" stroke="#6366F1" stroke-width="2" />
              <path d="M14 36 L38 22 L38 30 L46 30" fill="none" stroke="#6366F1" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round" />
              <path d="M38 30 L38 42 L14 36" fill="#6366F1" opacity="0.15" />
            </svg>
            <div>
              <div class="brand-name">dash</div>
              <div class="brand-desc">time tracking</div>
            </div>
          </div>
          <h1>Server nicht erreichbar</h1>
          <p>
            dash ist kurz nicht erreichbar – meist wegen eines Neustarts, das dauert weniger als eine Minute.
            Die Seite lädt automatisch neu, sobald der Server wieder da ist.
          </p>
          <div class="status" role="status" aria-live="polite">
            <span class="spinner" aria-hidden="true"></span>
            Warte auf den Server …
          </div>
          <button type="button" class="btn btn-primary" (click)="status.reloadPage()">Jetzt neu laden</button>
        </main>
      </div>
    }
  `,
  styles: `
    .server-down {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      place-items: center;
      padding: 16px;
      background: var(--bg);
    }
    .server-down-card {
      width: 100%;
      max-width: 440px;
      padding: 32px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm);
    }
    .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .brand svg { width: 40px; height: 40px; flex: none; }
    .brand-name { font-size: 22px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; }
    .brand-desc { font-size: 12px; color: var(--text-muted); }
    h1 { margin: 0 0 8px; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    p { margin: 0; color: var(--text-muted); }
    .status { display: flex; align-items: center; gap: 8px; margin-top: 24px; font-size: 13px; color: var(--text-muted); }
    .spinner {
      width: 14px; height: 14px; flex: none;
      border: 2px solid var(--border); border-top-color: var(--brand);
      border-radius: 50%; animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
    .btn { margin-top: 24px; }
  `,
})
export class ServerDownComponent {
  protected readonly status = inject(ServerStatusService);
}
