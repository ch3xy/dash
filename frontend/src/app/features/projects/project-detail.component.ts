import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProjectApiService } from '../../core/api/project-api.service';
import { ReportApiService } from '../../core/api/report-api.service';
import { TaskApiService } from '../../core/api/task-api.service';
import {
  BudgetStatus,
  PROJECT_STATUS_LABELS,
  Project,
  ProjectRate,
  ProjectStatus,
  Task,
  TaskInput,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { LucideArrowLeft, LucidePlus, LucideX } from '@lucide/angular';

type Tab = 'tasks' | 'rates';

@Component({
  selector: 'app-project-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, DurationPipe, MoneyPipe, LucideArrowLeft, LucidePlus, LucideX],
  template: `
    <div class="page">
      @if (project(); as p) {
        <div class="page-header">
          <div>
            <a routerLink="/projects" class="muted back-link"><svg lucideArrowLeft></svg> Projekte</a>
            <h1 class="row gap-2">
              <span class="badge-dot" [style.background]="p.color || 'var(--brand)'"></span>{{ p.name }}
            </h1>
            <div class="muted">{{ p.clientName || 'Kein Kunde' }}</div>
          </div>
          <select class="select" [ngModel]="p.status" (ngModelChange)="changeStatus($event)">
            @for (s of statuses; track s) { <option [ngValue]="s">{{ statusLabels[s] }}</option> }
          </select>
        </div>

        @if (budget(); as b) {
          <div class="card card-pad">
            <div class="card-title">Budget ({{ b.budgetPeriod }})</div>
            @if (b.hourBudgetMinutes) {
              <div class="row-between" style="margin-bottom: var(--sp-2)">
                <span class="mono">{{ b.usedMinutes * 60 | duration: 'HH:MM' }} / {{ b.hourBudgetMinutes * 60 | duration: 'HH:MM' }}</span>
                <span class="badge" [class]="budgetClass(b)">{{ b.usedPercent | number: '1.0-0' }}%</span>
              </div>
              <div class="progress" [class]="budgetClass(b)"><span [style.width.%]="min(b.usedPercent || 0, 100)"></span></div>
            } @else {
              <div class="muted">Kein Stundenbudget gesetzt.</div>
            }
            <div class="row mt-4" style="gap: var(--sp-6)">
              <div><div class="faint">Umsatz</div><strong class="mono">{{ b.revenueAmount | money: p.currencyCode }}</strong></div>
              @if (b.moneyBudgetAmount) {
                <div><div class="faint">Geldbudget</div><strong class="mono">{{ b.moneyBudgetAmount | money: p.currencyCode }}</strong></div>
              }
            </div>
          </div>
        }

        <div class="row mt-4" style="border-bottom: 1px solid var(--border); gap: 0;">
          <button class="tab" [class.active]="tab() === 'tasks'" (click)="tab.set('tasks')">Tasks</button>
          <button class="tab" [class.active]="tab() === 'rates'" (click)="tab.set('rates')">Ratenhistorie</button>
        </div>

        @if (tab() === 'tasks') {
          <div class="card card-pad mt-4">
            <div class="row" style="margin-bottom: var(--sp-4)">
              <input class="input" [(ngModel)]="newTask" placeholder="Task-Name" (keydown.enter)="addTask()" />
              <button class="btn btn-primary" (click)="addTask()" [disabled]="!newTask.trim()"><svg lucidePlus></svg> Task</button>
            </div>
            @if (tasks().length === 0) { <div class="muted">Noch keine Tasks.</div> }
            @for (t of tasks(); track t.id) {
              <div class="task-row">
                <div class="row-between">
                  <span>
                    {{ t.name }}
                    @if (t.archived) { <span class="badge muted">archiviert</span> }
                    @if (!t.billableByDefault) { <span class="badge muted">nicht abrechenbar</span> }
                  </span>
                  <div class="row gap-2">
                    <span class="mono faint">{{ trackedSeconds(t) | duration: 'HH:MM' }}@if (t.estimatedMinutes) { / {{ t.estimatedMinutes * 60 | duration: 'HH:MM' }} }</span>
                    @if (t.hourlyRateOverride) { <span class="mono faint">{{ t.hourlyRateOverride | money: p.currencyCode }}</span> }
                    <button class="btn btn-ghost btn-sm" (click)="editTask(t)">Bearbeiten</button>
                    @if (!t.archived) { <button class="btn btn-ghost btn-sm" (click)="archiveTask(t)">Archivieren</button> }
                  </div>
                </div>
                @if (t.estimatedMinutes) {
                  <div class="progress mt-2" [class]="estimateClass(t)"><span [style.width.%]="min(estimatePercent(t), 100)"></span></div>
                }
              </div>
            }
          </div>
        } @else {
          <div class="card card-pad mt-4">
            <div class="form-row" style="align-items: flex-end;">
              <div class="field"><label>Neuer Stundensatz</label><input class="input mono" type="number" [(ngModel)]="rateValue" /></div>
              <div class="field"><label>Gültig ab</label><input class="input" type="date" [(ngModel)]="rateFrom" /></div>
              <div class="field"><label>Notiz</label><input class="input" [(ngModel)]="rateNote" /></div>
              <button class="btn btn-primary" (click)="addRate(p)" [disabled]="!rateValue || !rateFrom">Hinzufügen</button>
            </div>
            <table class="table mt-4">
              <thead><tr><th>Satz</th><th>Gültig ab</th><th>Gültig bis</th><th>Notiz</th></tr></thead>
              <tbody>
                @for (r of rates(); track r.id) {
                  <tr>
                    <td class="mono">{{ r.hourlyRate | money: r.currencyCode }}</td>
                    <td>{{ r.validFrom | date: 'dd.MM.yyyy' }}</td>
                    <td>{{ r.validTo ? (r.validTo | date: 'dd.MM.yyyy') : 'aktuell' }}</td>
                    <td class="faint">{{ r.note || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        <div class="state"><div class="spinner"></div></div>
      }
    </div>

    @if (editingTask(); as t) {
      <div class="dialog-backdrop" (click)="closeTask()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>Task bearbeiten</h3>
            <button class="btn btn-ghost btn-icon" (click)="closeTask()" aria-label="Schließen"><svg lucideX></svg></button>
          </div>
          <div class="dialog-body">
            <div class="field"><label>Name *</label><input class="input" [(ngModel)]="taskForm.name" /></div>
            <div class="field"><label>Beschreibung</label><textarea class="textarea" [(ngModel)]="taskForm.description"></textarea></div>
            <div class="form-row">
              <div class="field">
                <label>Stundensatz-Override</label>
                <input class="input mono" type="number" [(ngModel)]="taskRate" placeholder="Projektsatz" />
              </div>
              <div class="field"><label>Schätzung (h)</label><input class="input mono" type="number" [(ngModel)]="taskEstimateHours" /></div>
            </div>
            <label class="switch"><input type="checkbox" [(ngModel)]="taskForm.billableByDefault" /> Standardmäßig abrechenbar</label>
          </div>
          <div class="dialog-footer">
            <button class="btn" (click)="closeTask()">Abbrechen</button>
            <button class="btn btn-primary" (click)="saveTask(t)" [disabled]="!taskForm.name.trim()">Speichern</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .tab { background: none; border: none; border-bottom: 2px solid transparent; padding: var(--sp-3) var(--sp-4);
           color: var(--text-muted); cursor: pointer; font-size: var(--fs-md); font-weight: 500; }
    .tab.active { color: var(--brand); border-bottom-color: var(--brand); }
    .task-row { padding: var(--sp-2) 0; border-bottom: 1px solid var(--border); }
  `],
})
export class ProjectDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly reportApi = inject(ReportApiService);
  private readonly toast = inject(ToastService);

  protected readonly statuses: ProjectStatus[] = ['ACTIVE', 'ARCHIVED'];
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly project = signal<Project | null>(null);
  protected readonly budget = signal<BudgetStatus | null>(null);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly rates = signal<ProjectRate[]>([]);
  protected readonly tab = signal<Tab>('tasks');
  /** taskId -> tracked seconds over the whole project lifetime */
  protected readonly taskSeconds = signal<Record<string, number>>({});
  protected readonly editingTask = signal<Task | null>(null);
  protected taskForm: TaskInput & { name: string } = { name: '' };
  protected taskRate: number | null = null;
  protected taskEstimateHours: number | null = null;

  protected newTask = '';
  protected rateValue: number | null = null;
  protected rateFrom = new Date().toISOString().slice(0, 10);
  protected rateNote = '';

  constructor() {
    queueMicrotask(() => this.loadAll());
  }

  private loadAll(): void {
    const id = this.id();
    this.api.get(id).subscribe((p) => this.project.set(p));
    this.api.budgetStatus(id).subscribe((b) => this.budget.set(b));
    this.loadTasks();
    this.api.rates(id).subscribe((r) => this.rates.set(r));
  }

  private loadTasks(): void {
    const id = this.id();
    this.taskApi.getForProject(id, true).subscribe((t) => this.tasks.set(t));
    this.reportApi.summary({ projectId: id, groupBy: 'TASK' }).subscribe((s) => {
      const map: Record<string, number> = {};
      for (const g of s.groups) {
        if (g.key) {
          map[g.key] = g.durationSeconds;
        }
      }
      this.taskSeconds.set(map);
    });
  }

  trackedSeconds(t: Task): number {
    return this.taskSeconds()[t.id] ?? 0;
  }

  estimatePercent(t: Task): number {
    return t.estimatedMinutes ? (this.trackedSeconds(t) / 60 / t.estimatedMinutes) * 100 : 0;
  }

  estimateClass(t: Task): string {
    const pct = this.estimatePercent(t);
    return pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
  }

  protected min(a: number, b: number): number {
    return Math.min(a, b);
  }

  budgetClass(b: BudgetStatus): string {
    const pct = b.usedPercent ?? 0;
    return pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
  }

  changeStatus(status: ProjectStatus): void {
    this.api.setStatus(this.id(), status).subscribe((p) => {
      this.project.set(p);
      this.toast.success('Status aktualisiert');
    });
  }

  addTask(): void {
    if (!this.newTask.trim()) {
      return;
    }
    const billableByDefault = this.project()?.billableByDefault ?? true;
    this.taskApi.create(this.id(), { name: this.newTask.trim(), billableByDefault }).subscribe(() => {
      this.newTask = '';
      this.loadTasks();
    });
  }

  archiveTask(t: Task): void {
    this.taskApi.archive(t.id).subscribe(() => this.loadTasks());
  }

  editTask(t: Task): void {
    this.taskForm = {
      name: t.name,
      description: t.description,
      billableByDefault: t.billableByDefault,
    };
    this.taskRate = t.hourlyRateOverride != null ? Number(t.hourlyRateOverride) : null;
    this.taskEstimateHours = t.estimatedMinutes != null ? t.estimatedMinutes / 60 : null;
    this.editingTask.set(t);
  }

  closeTask(): void {
    this.editingTask.set(null);
  }

  saveTask(t: Task): void {
    if (!this.taskForm.name.trim()) {
      return;
    }
    const payload: TaskInput = {
      ...this.taskForm,
      name: this.taskForm.name.trim(),
      hourlyRateOverride: this.taskRate != null ? this.taskRate.toFixed(2) : null,
      estimatedMinutes: this.taskEstimateHours != null ? Math.round(this.taskEstimateHours * 60) : null,
    };
    this.taskApi.update(t.id, payload).subscribe(() => {
      this.toast.success('Task gespeichert');
      this.closeTask();
      this.loadTasks();
    });
  }

  addRate(p: Project): void {
    if (this.rateValue == null || !this.rateFrom) {
      return;
    }
    this.api
      .addRate(this.id(), {
        hourlyRate: this.rateValue.toFixed(2),
        currencyCode: p.currencyCode,
        validFrom: new Date(`${this.rateFrom}T00:00:00`).toISOString(),
        note: this.rateNote || null,
      })
      .subscribe(() => {
        this.rateValue = null;
        this.rateNote = '';
        this.toast.success('Rate hinzugefügt');
        this.api.rates(this.id()).subscribe((r) => this.rates.set(r));
      });
  }
}
