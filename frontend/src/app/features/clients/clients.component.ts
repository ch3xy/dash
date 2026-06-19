import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClientApiService } from '../../core/api/client-api.service';
import { Client, ClientInput } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-clients',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Kunden</h1>
        <div class="row">
          <label class="switch"><input type="checkbox" [(ngModel)]="showArchived" (ngModelChange)="load()" /> Archivierte</label>
          <button class="btn btn-primary" (click)="openNew()">+ Kunde</button>
        </div>
      </div>

      @if (loading()) {
        <div class="state"><div class="spinner"></div></div>
      } @else if (clients().length === 0) {
        <div class="card state">Noch keine Kunden. Lege den ersten an.</div>
      } @else {
        <div class="card">
          <table class="table">
            <thead>
              <tr><th>Name</th><th>E-Mail</th><th>Währung</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              @for (c of clients(); track c.id) {
                <tr>
                  <td>
                    <strong>{{ c.name }}</strong>
                    @if (c.description) { <div class="faint">{{ c.description }}</div> }
                  </td>
                  <td>{{ c.email || '—' }}</td>
                  <td class="mono">{{ c.currencyCode }}</td>
                  <td>
                    @if (c.archived) { <span class="badge muted">Archiviert</span> }
                    @else { <span class="badge ok">Aktiv</span> }
                  </td>
                  <td class="text-right">
                    <button class="btn btn-ghost btn-sm" (click)="edit(c)">Bearbeiten</button>
                    @if (!c.archived) {
                      <button class="btn btn-ghost btn-sm" (click)="archive(c)">Archivieren</button>
                    }
                    <button class="btn btn-ghost btn-sm" (click)="remove(c)">Löschen</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (editing(); as e) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>{{ e.id ? 'Kunde bearbeiten' : 'Neuer Kunde' }}</h3>
            <button class="btn btn-ghost btn-icon" (click)="close()">✕</button>
          </div>
          <div class="dialog-body">
            <div class="field">
              <label>Name *</label>
              <input class="input" [(ngModel)]="form.name" />
            </div>
            <div class="field">
              <label>Beschreibung</label>
              <textarea class="textarea" [(ngModel)]="form.description"></textarea>
            </div>
            <div class="form-row">
              <div class="field"><label>E-Mail</label><input class="input" [(ngModel)]="form.email" /></div>
              <div class="field"><label>Website</label><input class="input" [(ngModel)]="form.website" /></div>
            </div>
            <div class="field" style="max-width: 120px;">
              <label>Währung</label>
              <input class="input mono" [(ngModel)]="form.currencyCode" maxlength="3" />
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn" (click)="close()">Abbrechen</button>
            <button class="btn btn-primary" (click)="save()" [disabled]="!form.name?.trim()">Speichern</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ClientsComponent {
  private readonly api = inject(ClientApiService);
  private readonly toast = inject(ToastService);

  protected readonly clients = signal<Client[]>([]);
  protected readonly loading = signal(true);
  protected readonly editing = signal<Client | { id: null } | null>(null);
  protected showArchived = false;
  protected form: ClientInput = { name: '', currencyCode: 'EUR' };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getAll(this.showArchived).subscribe({
      next: (c) => {
        this.clients.set(c);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openNew(): void {
    this.form = { name: '', description: '', email: '', website: '', currencyCode: 'EUR' };
    this.editing.set({ id: null });
  }

  edit(c: Client): void {
    this.form = {
      name: c.name,
      description: c.description,
      email: c.email,
      website: c.website,
      currencyCode: c.currencyCode,
    };
    this.editing.set(c);
  }

  close(): void {
    this.editing.set(null);
  }

  save(): void {
    const e = this.editing();
    if (!e || !this.form.name?.trim()) {
      return;
    }
    const req = e.id ? this.api.update(e.id, this.form) : this.api.create(this.form);
    req.subscribe(() => {
      this.toast.success('Gespeichert');
      this.close();
      this.load();
    });
  }

  archive(c: Client): void {
    this.api.archive(c.id).subscribe(() => {
      this.toast.success('Archiviert');
      this.load();
    });
  }

  remove(c: Client): void {
    if (!confirm(`Kunde „${c.name}" löschen?`)) {
      return;
    }
    this.api.delete(c.id).subscribe(() => {
      this.toast.success('Gelöscht');
      this.load();
    });
  }
}
