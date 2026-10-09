import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ClientApiService } from '../../core/api/client-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { Client } from '../../core/models';
import { loadViewSetting, saveViewSetting } from '../../core/view-state';
import { LucidePlus } from '@lucide/angular';
import { websiteHref } from '../../shared/utils/url-utils';
import { ClientFormDialogComponent } from './client-form-dialog.component';

@Component({
  selector: 'app-clients',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, LucidePlus, ClientFormDialogComponent],
  styles: [`.row-link { cursor: pointer; }`],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Kunden</h1>
        <div class="row">
          <label class="switch"><input type="checkbox" [(ngModel)]="showArchived" (ngModelChange)="load()" /> Archivierte</label>
          <button class="btn btn-primary" (click)="creating.set(true)"><svg lucidePlus></svg> Kunde</button>
        </div>
      </div>

      @if (loading()) {
        <div class="state"><div class="spinner"></div></div>
      } @else if (clients().length === 0) {
        <div class="card state">Noch keine Kunden. Lege den ersten an.</div>
      } @else {
        <div class="card" style="overflow-x: auto;">
          <table class="table">
            <thead>
              <tr><th>Name</th><th>E-Mail</th><th>Website</th><th class="num">Projekte</th><th>Währung</th><th>Status</th></tr>
            </thead>
            <tbody>
              @for (c of clients(); track c.id) {
                <tr class="row-link" (click)="open(c)">
                  <td>
                    <a [routerLink]="['/clients', c.id]" (click)="$event.stopPropagation()"><strong>{{ c.name }}</strong></a>
                    @if (c.description) { <div class="faint">{{ c.description }}</div> }
                  </td>
                  <td>{{ c.email || '—' }}</td>
                  <td>
                    @if (c.website) {
                      <a [href]="websiteHref(c.website)" target="_blank" rel="noopener" (click)="$event.stopPropagation()">{{ c.website }}</a>
                    } @else { — }
                  </td>
                  <td class="num mono">{{ projectCounts()[c.id] ?? 0 }}</td>
                  <td class="mono">{{ c.currencyCode }}</td>
                  <td>
                    @if (c.archived) { <span class="badge muted">Archiviert</span> }
                    @else { <span class="badge ok">Aktiv</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (creating()) {
      <app-client-form-dialog (saved)="onCreated()" (closed)="creating.set(false)" />
    }
  `,
})
export class ClientsComponent {
  private readonly api = inject(ClientApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly router = inject(Router);

  protected readonly clients = signal<Client[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  /** clientId -> number of projects (including archived ones) */
  protected readonly projectCounts = signal<Record<string, number>>({});
  protected readonly websiteHref = websiteHref;
  protected showArchived = loadViewSetting('clients.showArchived', false);

  constructor() {
    this.load();
    this.projectApi.getAll({ archived: true }).subscribe((projects) => {
      const counts: Record<string, number> = {};
      for (const p of projects) {
        if (p.clientId) {
          counts[p.clientId] = (counts[p.clientId] ?? 0) + 1;
        }
      }
      this.projectCounts.set(counts);
    });
  }

  load(): void {
    this.loading.set(true);
    saveViewSetting('clients.showArchived', this.showArchived);
    this.api.getAll(this.showArchived).subscribe({
      next: (c) => {
        this.clients.set(c);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  open(c: Client): void {
    this.router.navigate(['/clients', c.id]);
  }

  onCreated(): void {
    this.creating.set(false);
    this.load();
  }
}
