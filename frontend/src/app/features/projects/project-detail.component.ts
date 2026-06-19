import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProjectApiService } from '../../core/api/project-api.service';
import { TaskApiService } from '../../core/api/task-api.service';
import {
  BudgetStatus,
  Project,
  ProjectRate,
  ProjectStatus,
  Task,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

type Tab = 'tasks' | 'rates';

@Component({
  selector: 'app-project-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, DurationPipe, MoneyPipe],
  template: `
    <div class="page">
      @if (project(); as p) {
        <div class="page-header">
          <div>
            <a routerLink="/projects" class="muted">← Projekte</a>
            <h1 class="row gap-2">
              <span class="badge-dot" [style.background]="p.color || 'var(--brand)'"></span>{{ p.name }}
            </h1>
            <div class="muted">{{ p.clientName || 'Kein Kunde' }}</div>
          </div>
          <select class="select" [ngModel]="p.status" (ngModelChange)="changeStatus($event)">
            @for (s of statuses; track s) { <option [ngValue]="s">{{ s }}</option> }
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
              <button class="btn btn-primary" (click)="addTask()" [disabled]="!newTask.trim()">+ Task</button>
            </div>
            @if (tasks().length === 0) { <div class="muted">Noch keine Tasks.</div> }
            @for (t of tasks(); track t.id) {
              <div class="row-between" style="padding: var(--sp-2) 0; border-bottom: 1px solid var(--border);">
                <span>{{ t.name }} @if (t.archived) { <span class="badge muted">archiviert</span> }</span>
                <div class="row gap-2">
                  @if (t.hourlyRateOverride) { <span class="mono faint">{{ t.hourlyRateOverride | money: p.currencyCode }}</span> }
                  @if (!t.archived) { <button class="btn btn-ghost btn-sm" (click)="archiveTask(t)">Archivieren</button> }
                </div>
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
  `,
  styles: [`
    .tab { background: none; border: none; border-bottom: 2px solid transparent; padding: var(--sp-3) var(--sp-4);
           color: var(--text-muted); cursor: pointer; font-size: var(--fs-md); font-weight: 500; }
    .tab.active { color: var(--brand); border-bottom-color: var(--brand); }
  `],
})
export class ProjectDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly toast = inject(ToastService);

  protected readonly statuses: ProjectStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];
  protected readonly project = signal<Project | null>(null);
  protected readonly budget = signal<BudgetStatus | null>(null);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly rates = signal<ProjectRate[]>([]);
  protected readonly tab = signal<Tab>('tasks');

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
    this.taskApi.getForProject(id, true).subscribe((t) => this.tasks.set(t));
    this.api.rates(id).subscribe((r) => this.rates.set(r));
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
    this.taskApi.create(this.id(), { name: this.newTask.trim() }).subscribe(() => {
      this.newTask = '';
      this.taskApi.getForProject(this.id(), true).subscribe((t) => this.tasks.set(t));
    });
  }

  archiveTask(t: Task): void {
    this.taskApi.archive(t.id).subscribe(() =>
      this.taskApi.getForProject(this.id(), true).subscribe((tasks) => this.tasks.set(tasks)),
    );
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
