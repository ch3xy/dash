import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ReportApiService } from '../../core/api/report-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { TaskApiService } from '../../core/api/task-api.service';
import { TimesheetApiService } from '../../core/api/timesheet-api.service';
import { Project, Task, WeeklyReport } from '../../core/models';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { persistQueryParams } from '../../core/view-state';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { DateRange, parseIsoDate, weekRange } from '../../shared/utils/date-range';
import { addDays, toIsoDate } from '../../shared/utils/date-utils';
import { LucidePlus } from '@lucide/angular';

interface Row {
  key: string;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  taskId: string | null;
  taskName: string | null;
  /** date -> seconds */
  byDate: Record<string, number>;
}

interface ExtraRow {
  projectId: string;
  taskId: string | null;
}

const rowKey = (projectId: string, taskId: string | null) => `${projectId}:${taskId ?? ''}`;

/** Parses "1:30", "1,5", "1.5" or "90m" into seconds; null for invalid input, 0 for empty. */
export function parseDuration(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (s === '' || s === '·') {
    return 0;
  }
  let m = /^(\d{1,2}):([0-5]\d)$/.exec(s);
  if (m) {
    return Number(m[1]) * 3600 + Number(m[2]) * 60;
  }
  m = /^(\d+)\s*m$/.exec(s);
  if (m) {
    return Number(m[1]) * 60;
  }
  if (/^\d+(\.\d+)?\s*h?$/.test(s)) {
    return Math.round(parseFloat(s) * 60) * 60;
  }
  return null;
}

@Component({
  selector: 'app-timesheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DurationPipe, DateRangePickerComponent, LucidePlus],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Timesheet</h1>
        <div class="row">
          <app-date-range-picker mode="week" ariaLabel="Woche" [range]="week()" (rangeChange)="setWeek($event)" />
          <button class="btn btn-sm" (click)="copyPreviousWeek()" [disabled]="saving()">Vorwoche kopieren</button>
        </div>
      </div>

      @if (loading() && !report()) {
        <div class="state"><div class="spinner"></div></div>
      } @else if (error()) {
        <div class="state">
          <p>Woche konnte nicht geladen werden.</p>
          <button class="btn btn-sm" (click)="load()">Erneut versuchen</button>
        </div>
      } @else if (report(); as r) {
        <div class="card" style="overflow-x: auto;">
          <table class="table timesheet">
            <thead>
              <tr>
                <th style="min-width: 200px;">Projekt / Task</th>
                @for (d of r.days; track d.date) {
                  <th class="num">{{ dayLabel(d.date) }}</th>
                }
                <th class="num">Σ</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.key) {
                <tr>
                  <td>
                    <span class="row gap-2">
                      <span class="badge-dot" [style.background]="row.projectColor || 'var(--brand)'"></span>
                      <strong>{{ row.projectName }}</strong>
                      @if (row.taskName) { <span class="muted">· {{ row.taskName }}</span> }
                    </span>
                  </td>
                  @for (d of r.days; track d.date) {
                    <td class="num cell">
                      <input
                        class="cell-input mono"
                        [value]="row.byDate[d.date] ? (row.byDate[d.date] | duration: 'HH:MM') : ''"
                        placeholder="·"
                        [disabled]="saving()"
                        [attr.aria-label]="row.projectName + (row.taskName ? ' · ' + row.taskName : '') + ' am ' + d.date"
                        (focus)="$any($event.target).select()"
                        (keydown.enter)="$any($event.target).blur()"
                        (keydown.escape)="reset($event, row, d.date)"
                        (change)="saveCell($event, row, d.date)" />
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
          <select class="select" [(ngModel)]="newProjectId" style="max-width: 240px;" aria-label="Projekt für neue Zeile">
            <option [ngValue]="null" disabled>Projekt…</option>
            @for (p of projects(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
          <select class="select" [(ngModel)]="newTaskId" [disabled]="!newProjectId()" style="max-width: 200px;" aria-label="Task für neue Zeile">
            <option [ngValue]="null">Ohne Task</option>
            @for (t of newTasks(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
          </select>
          <button class="btn btn-sm" (click)="addRow()" [disabled]="!newProjectId()"><svg lucidePlus></svg> Zeile</button>
          <span class="muted">Zellen akzeptieren 1:30, 1,5 oder 90m. Enter speichert, leer löscht.</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .cell { padding: 2px 4px; }
    .cell-input {
      width: 64px; text-align: right; border: 1px solid transparent; border-radius: var(--radius-sm, 4px);
      background: transparent; color: inherit; padding: 4px 6px; font: inherit;
    }
    .cell-input:hover { background: var(--brand-soft); }
    .cell-input:focus { outline: none; border-color: var(--brand); background: var(--surface, transparent); }
    .text-center { text-align: center; }
  `],
})
export class TimesheetComponent {
  private readonly reportApi = inject(ReportApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly timesheetApi = inject(TimesheetApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly report = signal<WeeklyReport | null>(null);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly saving = signal(false);
  /** Displayed Mon–Sun week from the URL (?week=YYYY-MM-DD), defaulting to the current week. */
  protected readonly week = toSignal(
    this.route.queryParamMap.pipe(map((p) => weekRange(p.get('week') || toIsoDate(new Date())))),
    { initialValue: weekRange(toIsoDate(new Date())) },
  );

  protected get weekStart(): Date {
    return parseIsoDate(this.week().from);
  }
  private readonly extraRows = signal<ExtraRow[]>([]);
  private readonly taskNames = signal<Record<string, string>>({});

  protected readonly newProjectId = signal<string | null>(null);
  protected readonly newTaskId = signal<string | null>(null);
  protected readonly newTasks = signal<Task[]>([]);

  protected readonly rows = computed<Row[]>(() => {
    const r = this.report();
    if (!r) {
      return [];
    }
    const map = new Map<string, Row>();
    for (const day of r.days) {
      for (const e of day.entries) {
        const key = rowKey(e.projectId, e.taskId);
        let row = map.get(key);
        if (!row) {
          row = {
            key, projectId: e.projectId, projectName: e.projectName, projectColor: e.projectColor,
            taskId: e.taskId, taskName: e.taskName, byDate: {},
          };
          map.set(key, row);
        }
        row.byDate[day.date] = (row.byDate[day.date] ?? 0) + e.durationSeconds;
      }
    }
    for (const extra of this.extraRows()) {
      const key = rowKey(extra.projectId, extra.taskId);
      const p = this.projects().find((x) => x.id === extra.projectId);
      if (!map.has(key) && p) {
        map.set(key, {
          key, projectId: p.id, projectName: p.name, projectColor: p.color ?? null,
          taskId: extra.taskId, taskName: extra.taskId ? (this.taskNames()[extra.taskId] ?? null) : null, byDate: {},
        });
      }
    }
    return [...map.values()].sort(
      (a, b) => a.projectName.localeCompare(b.projectName) || (a.taskName ?? '').localeCompare(b.taskName ?? ''),
    );
  });

  constructor() {
    persistQueryParams('timesheet');
    this.projectApi.getAll({ status: 'ACTIVE' }).subscribe((p) => this.projects.set(p));
    effect(() => {
      const projectId = this.newProjectId();
      this.newTaskId.set(null);
      this.newTasks.set([]);
      if (projectId) {
        this.taskApi.getForProject(projectId).subscribe((t) => this.newTasks.set(t));
      }
    });
    effect(() => {
      this.week();
      untracked(() => this.load());
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.reportApi.weekly(toIsoDate(this.weekStart)).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected setWeek(range: DateRange): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { week: range.from }, queryParamsHandling: 'merge' });
  }

  dayLabel(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit' });
  }

  rowTotal(row: Row): number {
    return Object.values(row.byDate).reduce((s, v) => s + v, 0);
  }

  addRow(): void {
    const projectId = this.newProjectId();
    if (!projectId) {
      return;
    }
    const taskId = this.newTaskId();
    const task = this.newTasks().find((t) => t.id === taskId);
    if (task) {
      this.taskNames.update((n) => ({ ...n, [task.id]: task.name }));
    }
    this.extraRows.update((rows) =>
      rows.some((r) => r.projectId === projectId && r.taskId === taskId) ? rows : [...rows, { projectId, taskId }],
    );
    this.newProjectId.set(null);
  }

  reset(event: Event, row: Row, date: string): void {
    const input = event.target as HTMLInputElement;
    input.value = this.format(row.byDate[date] ?? 0);
    input.blur();
  }

  async saveCell(event: Event, row: Row, date: string): Promise<void> {
    const input = event.target as HTMLInputElement;
    const current = row.byDate[date] ?? 0;
    const seconds = parseDuration(input.value);
    if (seconds == null || seconds > 24 * 3600) {
      this.toast.error('Ungültige Dauer — z. B. 1:30, 1,5 oder 90m');
      input.value = this.format(current);
      return;
    }
    if (seconds === current) {
      input.value = this.format(current);
      return;
    }
    if (seconds === 0) {
      const ok = await this.dialog.confirm({
        title: 'Einträge löschen?',
        message: `Alle Einträge von ${row.projectName}${row.taskName ? ' · ' + row.taskName : ''} am ${date} werden gelöscht.`,
        confirmLabel: 'Löschen',
        danger: true,
      });
      if (!ok) {
        input.value = this.format(current);
        return;
      }
    }
    this.saving.set(true);
    this.timesheetApi.setCell({ projectId: row.projectId, taskId: row.taskId, date, durationSeconds: seconds }).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
      },
      error: () => {
        this.saving.set(false);
        input.value = this.format(current);
      },
    });
  }

  async copyPreviousWeek(): Promise<void> {
    const ok = await this.dialog.confirm({
      title: 'Vorwoche kopieren?',
      message: 'Alle Einträge der Vorwoche werden mit gleichen Uhrzeiten in diese Woche übernommen.',
      confirmLabel: 'Kopieren',
    });
    if (!ok) {
      return;
    }
    this.saving.set(true);
    const target = toIsoDate(this.weekStart);
    this.timesheetApi.copyWeek(toIsoDate(addDays(this.weekStart, -7)), target).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.toast.success(created.length ? `${created.length} Einträge kopiert` : 'Vorwoche hat keine Einträge');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  private format(seconds: number): string {
    if (!seconds) {
      return '';
    }
    const m = Math.round(seconds / 60);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }
}
