import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClientApiService } from '../../core/api/client-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { Client, Project, ProjectInput, ProjectRate } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { LucideX } from '@lucide/angular';

/** Create/edit dialog for project master data. `project` null means "new project". */
@Component({
  selector: 'app-project-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MoneyPipe, LucideX],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h3>{{ project() ? 'Projekt bearbeiten' : 'Neues Projekt' }}</h3>
          <button class="btn btn-ghost btn-icon" (click)="closed.emit()" aria-label="Schließen"><svg lucideX></svg></button>
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
            <div class="field">
              <label>Standard-Satz (Fallback)</label>
              <input class="input mono" type="number" [(ngModel)]="form.defaultHourlyRate" />
            </div>
            <div class="field" style="max-width: 100px;"><label>Währung</label><input class="input mono" [(ngModel)]="form.currencyCode" maxlength="3" /></div>
          </div>
          @if (activeRate(); as r) {
            <div class="faint" style="margin-top: calc(-1 * var(--sp-2)); margin-bottom: var(--sp-3);">
              Aktiv ist der Satz {{ r.hourlyRate | money: r.currencyCode }} aus der Ratenhistorie. Er hat Vorrang vor dem Standard-Satz.
            </div>
          }
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
          <button class="btn" (click)="closed.emit()">Abbrechen</button>
          <button class="btn btn-primary" (click)="save()" [disabled]="!form.name?.trim()">Speichern</button>
        </div>
      </div>
    </div>
  `,
})
export class ProjectFormDialogComponent implements OnInit {
  readonly project = input<Project | null>(null);
  /** Currently valid entry of the rate history; overrides the default rate when set. */
  readonly activeRate = input<ProjectRate | null>(null);
  readonly saved = output<Project>();
  readonly closed = output<void>();

  private readonly api = inject(ProjectApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly toast = inject(ToastService);

  protected readonly clients = signal<Client[]>([]);
  protected budgetHours: number | null = null;
  protected form: ProjectInput = {
    name: '',
    clientId: null,
    color: '#6366f1',
    defaultHourlyRate: '0.00',
    currencyCode: 'EUR',
    billableByDefault: true,
    budgetReset: 'NONE',
  };

  ngOnInit(): void {
    this.clientApi.getAll().subscribe((c) => this.clients.set(c));
    const p = this.project();
    if (p) {
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
    }
  }

  save(): void {
    if (!this.form.name?.trim()) {
      return;
    }
    const payload: ProjectInput = {
      ...this.form,
      hourBudgetMinutes: this.budgetHours != null ? Math.round(this.budgetHours * 60) : null,
    };
    const p = this.project();
    const req = p ? this.api.update(p.id, payload) : this.api.create(payload);
    req.subscribe((result) => {
      this.toast.success('Gespeichert');
      this.saved.emit(result);
    });
  }
}
