import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportApiService } from '../../core/api/report-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { TimeEntryApiService } from '../../core/api/time-entry-api.service';
import { Project, WeeklyReport } from '../../core/models';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { addDays, startOfWeek, toInstant, toIsoDate } from '../../shared/utils/date-utils';

interface Row {
  projectId: string;
  projectName: string;
  /** date -> seconds */
  byDate: Record<string, number>;
}

@Component({
  selector: 'app-timesheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DurationPipe],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Timesheet</h1>
        <div class="row">
          <button class="btn btn-sm" (click)="shift(-7)">←</button>
          <span class="mono">{{ weekLabel() }}</span>
          <button class="btn btn-sm" (click)="shift(7)">→</button>
          <button class="btn btn-sm" (click)="goToday()">Heute</button>
        </div>
      </div>

      @if (loading()) {
        <div class="state"><div class="spinner"></div></div>
      } @else if (report(); as r) {
        <div class="card" style="overflow-x: auto;">
          <table class="table timesheet">
            <thead>
              <tr>
                <th style="min-width: 180px;">Projekt</th>
                @for (d of r.days; track d.date) {
                  <th class="num">{{ dayLabel(d.date) }}</th>
                }
                <th class="num">Σ</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.projectId) {
                <tr>
                  <td><strong>{{ row.projectName }}</strong></td>
                  @for (d of r.days; track d.date) {
                    <td class="num cell" (click)="addTime(row, d.date)">
                      {{ row.byDate[d.date] ? (row.byDate[d.date] | duration: 'HH:MM') : '·' }}
                    </td>
                  }
                  <td class="num mono"><strong>{{ rowTotal(row) | duration: 'HH:MM' }}</strong></td>
                </tr>
              }
              @if (rows().length === 0) {
                <tr><td [attr.colspan]="r.days.length + 2" class="muted text-center">Keine Einträge diese Woche.</td></tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Tagesgesamt</strong></td>
                @for (d of r.days; track d.date) {
                  <td class="num mono"><strong>{{ d.totalSeconds | duration: 'HH:MM' }}</strong></td>
                }
                <td class="num mono"><strong>{{ r.weekTotalSeconds | duration: 'HH:MM' }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="card card-pad mt-4 row">
          <select class="select" [ngModel]="null" (ngModelChange)="addRow($event)" style="max-width: 240px;">
            <option [ngValue]="null" disabled>+ Projektzeile hinzufügen…</option>
            @for (p of projects(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
          <span class="muted">Klicke eine Tageszelle, um Zeit einzutragen.</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .cell { cursor: pointer; }
    .cell:hover { background: var(--brand-soft); }
    .text-center { text-align: center; }
  `],
})
export class TimesheetComponent {
  private readonly reportApi = inject(ReportApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly entryApi = inject(TimeEntryApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);

  protected readonly report = signal<WeeklyReport | null>(null);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected weekStart = startOfWeek(new Date());
  private readonly extraProjectIds = signal<string[]>([]);

  protected readonly rows = computed<Row[]>(() => {
    const r = this.report();
    if (!r) {
      return [];
    }
    const map = new Map<string, Row>();
    for (const day of r.days) {
      for (const e of day.entries) {
        let row = map.get(e.projectId);
        if (!row) {
          row = { projectId: e.projectId, projectName: e.projectName, byDate: {} };
          map.set(e.projectId, row);
        }
        row.byDate[day.date] = (row.byDate[day.date] ?? 0) + e.durationSeconds;
      }
    }
    for (const pid of this.extraProjectIds()) {
      if (!map.has(pid)) {
        const p = this.projects().find((x) => x.id === pid);
        if (p) {
          map.set(pid, { projectId: pid, projectName: p.name, byDate: {} });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.projectName.localeCompare(b.projectName));
  });

  protected readonly weekLabel = computed(() => {
    const end = addDays(this.weekStart, 6);
    return `${this.weekStart.toLocaleDateString('de-AT')} – ${end.toLocaleDateString('de-AT')}`;
  });

  constructor() {
    this.projectApi.getAll({ status: 'ACTIVE' }).subscribe((p) => this.projects.set(p));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.reportApi.weekly(toIsoDate(this.weekStart)).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  shift(days: number): void {
    this.weekStart = addDays(this.weekStart, days);
    this.load();
  }

  goToday(): void {
    this.weekStart = startOfWeek(new Date());
    this.load();
  }

  dayLabel(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit' });
  }

  rowTotal(row: Row): number {
    return Object.values(row.byDate).reduce((s, v) => s + v, 0);
  }

  addRow(projectId: string | null): void {
    if (projectId) {
      this.extraProjectIds.update((ids) => (ids.includes(projectId) ? ids : [...ids, projectId]));
    }
  }

  addTime(row: Row, date: string): void {
    const projectId = row.projectId;
    this.dialog
      .prompt({ title: `Zeit erfassen — ${row.projectName}`, label: `Stunden am ${date}`, value: '1', placeholder: 'z. B. 1,5' })
      .then((input) => {
        if (input == null) {
          return;
        }
        const hours = Number(input.replace(',', '.'));
        if (!hours || hours <= 0) {
          this.toast.error('Ungültige Stundenzahl');
          return;
        }
        const start = toInstant(date, '09:00');
        const end = new Date(new Date(start).getTime() + hours * 3600 * 1000).toISOString();
        this.entryApi
          .create({ projectId, taskId: null, description: null, startTime: start, endTime: end, billable: true })
          .subscribe(() => {
            this.toast.success('Zeit eingetragen');
            this.load();
          });
      });
  }
}
