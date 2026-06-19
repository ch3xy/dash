import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ClientApiService } from '../../core/api/client-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { Client, Project, ProjectInput, ProjectStatus } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

const STATUSES: ProjectStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];

@Component({
  selector: 'app-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DurationPipe, MoneyPipe],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Projekte</h1>
        <div class="row">
          <select class="select" [(ngModel)]="statusFilter" (ngModelChange)="load()">
            <option [ngValue]="undefined">Alle Status</option>
            @for (s of statuses; track s) { <option [ngValue]="s">{{ s }}</option> }
          </select>
          <button class="btn btn-primary" (click)="openNew()">+ Projekt</button>
        </div>
      </div>

      @if (loading()) {
        <div class="state"><div class="spinner"></div></div>
      } @else if (projects().length === 0) {
        <div class="card state">Noch keine Projekte.</div>
      } @else {
        <div class="card">
          <table class="table">
            <thead>
              <tr><th>Projekt</th><th>Kunde</th><th>Status</th><th>Budget</th><th class="num">Satz</th><th></th></tr>
            </thead>
            <tbody>
              @for (p of projects(); track p.id) {
                <tr>
                  <td>
                    <span class="row gap-2">
                      <span class="badge-dot" [style.background]="p.color || 'var(--brand)'"></span>
                      <a [routerLink]="['/projects', p.id]"><strong>{{ p.name }}</strong></a>
                    </span>
                  </td>
                  <td>{{ p.clientName || '—' }}</td>
                  <td><span class="badge" [class]="statusClass(p.status)">{{ p.status }}</span></td>
                  <td>{{ p.hourBudgetMinutes ? (p.hourBudgetMinutes * 60 | duration: 'HH:MM') : '—' }}</td>
                  <td class="num mono">{{ p.defaultHourlyRate | money: p.currencyCode }}</td>
                  <td class="text-right"><button class="btn btn-ghost btn-sm" (click)="edit(p)">Bearbeiten</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (editing()) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>{{ editingId ? 'Projekt bearbeiten' : 'Neues Projekt' }}</h3>
            <button class="btn btn-ghost btn-icon" (click)="close()">✕</button>
          </div>
          <div class="dialog-body">
            <div class="field"><label>Name *</label><input class="input" [(ngModel)]="form.name" /></div>
            <div class="form-row">
              <div class="field">
                <label>Kunde</label>
                <select class="select" [(ngModel)]="form.clientId">
                  <option [ngValue]="null">— Kein Kunde —</option>
                  @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
                </select>
              </div>
              <div class="field" style="max-width: 90px; flex: 0 0 90px;">
                <label>Farbe</label>
                <input class="input" type="color" [(ngModel)]="form.color" style="padding: 2px;" />
              </div>
            </div>
            <div class="field"><label>Beschreibung</label><textarea class="textarea" [(ngModel)]="form.description"></textarea></div>
            <div class="form-row">
              <div class="field"><label>Std.-Satz</label><input class="input mono" type="number" [(ngModel)]="form.defaultHourlyRate" /></div>
              <div class="field" style="max-width: 100px;"><label>Währung</label><input class="input mono" [(ngModel)]="form.currencyCode" maxlength="3" /></div>
            </div>
            <div class="form-row">
              <div class="field"><label>Stundenbudget (h)</label><input class="input mono" type="number" [(ngModel)]="budgetHours" /></div>
              <div class="field"><label>Geldbudget</label><input class="input mono" type="number" [(ngModel)]="form.moneyBudgetAmount" /></div>
              <div class="field">
                <label>Budget-Reset</label>
                <select class="select" [(ngModel)]="form.budgetReset">
                  <option value="NONE">Keiner</option><option value="MONTHLY">Monatlich</option><option value="YEARLY">Jährlich</option>
                </select>
              </div>
            </div>
            <label class="switch"><input type="checkbox" [(ngModel)]="form.billableByDefault" /> Standardmäßig abrechenbar</label>
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
export class ProjectsComponent {
  private readonly api = inject(ProjectApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly toast = inject(ToastService);

  protected readonly statuses = STATUSES;
  protected readonly projects = signal<Project[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly loading = signal(true);
  protected readonly editing = signal(false);
  protected editingId: string | null = null;
  protected statusFilter: ProjectStatus | undefined = undefined;
  protected budgetHours: number | null = null;
  protected form: ProjectInput = this.empty();

  constructor() {
    this.load();
    this.clientApi.getAll().subscribe((c) => this.clients.set(c));
  }

  private empty(): ProjectInput {
    return {
      name: '',
      clientId: null,
      color: '#6366f1',
      defaultHourlyRate: '0.00',
      currencyCode: 'EUR',
      billableByDefault: true,
      budgetReset: 'NONE',
    };
  }

  load(): void {
    this.loading.set(true);
    this.api.getAll({ status: this.statusFilter }).subscribe({
      next: (p) => {
        this.projects.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  statusClass(s: ProjectStatus): string {
    return s === 'ACTIVE' ? 'ok' : s === 'PAUSED' ? 'warn' : s === 'ARCHIVED' ? 'muted' : 'info';
  }

  openNew(): void {
    this.form = this.empty();
    this.budgetHours = null;
    this.editingId = null;
    this.editing.set(true);
  }

  edit(p: Project): void {
    this.form = {
      name: p.name,
      clientId: p.clientId,
      color: p.color,
      description: p.description,
      defaultHourlyRate: p.defaultHourlyRate,
      currencyCode: p.currencyCode,
      billableByDefault: p.billableByDefault,
      moneyBudgetAmount: p.moneyBudgetAmount,
      budgetReset: p.budgetReset,
    };
    this.budgetHours = p.hourBudgetMinutes != null ? p.hourBudgetMinutes / 60 : null;
    this.editingId = p.id;
    this.editing.set(true);
  }

  close(): void {
    this.editing.set(false);
  }

  save(): void {
    if (!this.form.name?.trim()) {
      return;
    }
    const payload: ProjectInput = {
      ...this.form,
      hourBudgetMinutes: this.budgetHours != null ? Math.round(this.budgetHours * 60) : null,
    };
    const req = this.editingId ? this.api.update(this.editingId, payload) : this.api.create(payload);
    req.subscribe(() => {
      this.toast.success('Gespeichert');
      this.close();
      this.load();
    });
  }
}
