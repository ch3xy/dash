import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjectApiService } from '../../core/api/project-api.service';
import { ReportApiService } from '../../core/api/report-api.service';
import { BudgetReportRow, PROJECT_STATUS_LABELS, Project, ProjectStatus } from '../../core/models';
import { loadViewSetting, saveViewSetting } from '../../core/view-state';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { LucidePlus } from '@lucide/angular';
import { ProjectFormDialogComponent } from './project-form-dialog.component';

const STATUSES: ProjectStatus[] = ['ACTIVE', 'ARCHIVED'];

@Component({
  selector: 'app-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DecimalPipe, DurationPipe, MoneyPipe, LucidePlus, ProjectFormDialogComponent],
  styles: [`.row-link { cursor: pointer; }`],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Projekte</h1>
        <div class="row">
          <select class="select" [(ngModel)]="statusFilter" (ngModelChange)="load()">
            <option [ngValue]="undefined">Alle Status</option>
            @for (s of statuses; track s) { <option [ngValue]="s">{{ statusLabels[s] }}</option> }
          </select>
          <button class="btn btn-primary" (click)="creating.set(true)"><svg lucidePlus></svg> Projekt</button>
        </div>
      </div>

      @if (loading()) {
        <div class="state"><div class="spinner"></div></div>
      } @else if (projects().length === 0) {
        <div class="card state">Noch keine Projekte.</div>
      } @else {
        <div class="card" style="overflow-x: auto;">
          <table class="table">
            <thead>
              <tr><th>Projekt</th><th>Kunde</th><th>Status</th><th>Budget</th><th class="num">Verbrauch</th><th class="num">Satz</th></tr>
            </thead>
            <tbody>
              @for (p of projects(); track p.id) {
                <tr class="row-link" (click)="open(p)">
                  <td>
                    <span class="row gap-2">
                      <span class="badge-dot" [style.background]="p.color || 'var(--brand)'"></span>
                      <a [routerLink]="['/projects', p.id]" (click)="$event.stopPropagation()"><strong>{{ p.name }}</strong></a>
                    </span>
                  </td>
                  <td>{{ p.clientName || '—' }}</td>
                  <td><span class="badge" [class]="statusClass(p.status)">{{ statusLabels[p.status] }}</span></td>
                  @if (budgets()[p.id]; as b) {
                    <td style="min-width: 160px;">
                      <div class="mono">{{ b.usedMinutes * 60 | duration: 'HH:MM' }} / {{ p.hourBudgetMinutes! * 60 | duration: 'HH:MM' }}</div>
                      <div class="progress" [class]="budgetClass(b)"><span [style.width.%]="min(b.usedPercent ?? 0, 100)"></span></div>
                    </td>
                    <td class="num"><span class="badge" [class]="budgetClass(b)">{{ b.usedPercent ?? 0 | number: '1.0-0' }}%</span></td>
                  } @else {
                    <td class="mono">{{ p.hourBudgetMinutes ? (p.hourBudgetMinutes * 60 | duration: 'HH:MM') : '—' }}</td>
                    <td class="num faint">—</td>
                  }
                  <td class="num mono">{{ p.defaultHourlyRate | money: p.currencyCode }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (creating()) {
      <app-project-form-dialog (saved)="onCreated()" (closed)="creating.set(false)" />
    }
  `,
})
export class ProjectsComponent {
  private readonly api = inject(ProjectApiService);
  private readonly reportApi = inject(ReportApiService);
  private readonly router = inject(Router);

  protected readonly statuses = STATUSES;
  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly creating = signal(false);
  /** projectId -> budget usage in the current budget period (only active projects with an hour budget). */
  protected readonly budgets = signal<Record<string, BudgetReportRow>>({});
  // A persisted filter may still hold a removed status (PAUSED/COMPLETED); fall back to "all".
  protected statusFilter: ProjectStatus | undefined = STATUSES.find(
    (s) => s === loadViewSetting<string | null>('projects.status', null),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    saveViewSetting('projects.status', this.statusFilter ?? null);
    this.api.getAll(this.statusFilter ? { status: this.statusFilter } : { archived: true }).subscribe({
      next: (p) => {
        this.projects.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.reportApi.budget({}).subscribe((rows) => {
      this.budgets.set(Object.fromEntries(rows.map((r) => [r.projectId, r])));
    });
  }

  budgetClass(b: BudgetReportRow): string {
    return b.status === 'EXCEEDED' ? 'danger' : b.status === 'WARNING' ? 'warn' : 'ok';
  }

  protected min(a: number, b: number): number {
    return Math.min(a, b);
  }

  statusClass(s: ProjectStatus): string {
    return s === 'ACTIVE' ? 'ok' : 'muted';
  }

  open(p: Project): void {
    this.router.navigate(['/projects', p.id]);
  }

  onCreated(): void {
    this.creating.set(false);
    this.load();
  }
}
