import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ProjectApiService } from '../../core/api/project-api.service';
import { TagApiService } from '../../core/api/tag-api.service';
import { TaskApiService } from '../../core/api/task-api.service';
import { TimeEntryApiService } from '../../core/api/time-entry-api.service';
import { KeyboardShortcutService } from '../../core/keyboard-shortcut.service';
import { DialogService } from '../../core/dialog.service';
import { Project, RecentCombination, Tag, Task, TimeEntry, TimeEntryInput } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { TimerStateService } from '../../core/timer-state.service';
import { AutofocusDirective } from '../../shared/directives/autofocus.directive';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { addDays, timeOf, toInstant, today, toIsoDate } from '../../shared/utils/date-utils';

interface EntryGroup {
  key: string;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  taskId: string | null;
  taskName: string | null;
  description: string | null;
  billable: boolean;
  totalSeconds: number;
  entries: TimeEntry[];
}

@Component({
  selector: 'app-timer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DurationPipe, MoneyPipe, AutofocusDirective],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Timer</h1>
        <div class="row gap-2">
          <button class="btn btn-sm" (click)="shiftDay(-1)">←</button>
          <span class="mono" style="min-width: 100px; text-align: center;">
            {{ viewDateLabel() }}
          </span>
          <button class="btn btn-sm" (click)="shiftDay(1)" [disabled]="viewDate() === todayIso">→</button>
          <button class="btn btn-sm" (click)="goToday()" [disabled]="viewDate() === todayIso">Heute</button>
        </div>
        <button class="btn btn-primary" (click)="openNew()">+ Eintrag</button>
      </div>

      <div class="card card-pad row-between">
        <div>
          <div class="card-title" style="margin: 0">{{ viewDateLabel() }} gesamt</div>
          <div class="stat-value">{{ totalSeconds() | duration: 'HH:MM' }}</div>
        </div>
        <div class="text-right">
          <div class="faint">Umsatz</div>
          <strong class="mono">{{ totalRevenue() | money }}</strong>
        </div>
      </div>

      @if (recent().length) {
        <div class="row wrap gap-2 mt-4">
          <span class="faint">Zuletzt verwendet:</span>
          @for (c of recent(); track c.projectId + (c.taskId ?? '')) {
            <button class="btn btn-sm" (click)="startFromCombo(c)" [disabled]="timerState.isRunning()"
                    title="Timer mit dieser Kombination starten">
              ▶ {{ c.projectName }}@if (c.taskName) { <span class="faint"> · {{ c.taskName }}</span> }
            </button>
          }
        </div>
      }

      @if (loading()) {
        <div class="state"><div class="spinner"></div></div>
      } @else if (entries().length === 0) {
        <div class="card state">Noch keine Einträge {{ viewDateLabel() === 'Heute' ? 'heute' : 'an diesem Tag' }}.</div>
      } @else {
        <div class="card mt-4">
          <table class="table">
            <thead>
              <tr>
                <th></th>
                <th>Beschreibung</th>
                <th>Projekt</th>
                <th>Zeit</th>
                <th class="num">Dauer</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (g of groupedEntries(); track g.key) {
                <!-- Group header row -->
                <tr class="group-row" [class.group-expanded]="expandedGroups().has(g.key)">
                  <td class="expand-col">
                    @if (g.entries.length > 1) {
                      <button class="btn btn-ghost btn-icon btn-sm"
                              (click)="toggleGroup(g.key)"
                              title="{{ expandedGroups().has(g.key) ? 'Einklappen' : 'Aufklappen' }}">
                        {{ expandedGroups().has(g.key) ? '▾' : '▸' }}
                      </button>
                    }
                  </td>
                  <td>
                    @if (g.entries.length === 1 && editingDescId() === g.entries[0].id) {
                      <input class="input" [ngModel]="g.description ?? ''" appAutofocus
                             (keydown.enter)="$any($event.target).blur()"
                             (keydown.escape)="editingDescId.set(null)"
                             (blur)="saveDescription(g.entries[0], $any($event.target).value)" />
                    } @else {
                      <span [class.text-link]="g.entries.length === 1"
                            (click)="g.entries.length === 1 ? editingDescId.set(g.entries[0].id) : null"
                            [title]="g.entries.length === 1 ? 'Klicken zum Bearbeiten' : ''"
                            [style.cursor]="g.entries.length === 1 ? 'text' : 'default'">
                        {{ g.description || '(keine Beschreibung)' }}
                      </span>
                      @if (g.entries.length > 1) {
                        <span class="badge muted">{{ g.entries.length }}×</span>
                      }
                      @if (!g.billable) { <span class="badge muted">nicht abrechenbar</span> }
                      @for (t of g.entries[0].tags; track t.id) {
                        <span class="badge" [style.color]="t.color || 'var(--text)'">{{ t.name }}</span>
                      }
                    }
                  </td>
                  <td>
                    <span class="row gap-2">
                      <span class="badge-dot" [style.background]="g.projectColor || 'var(--brand)'"></span>
                      {{ g.projectName }}
                    </span>
                    @if (g.taskName) { <span class="faint"> · {{ g.taskName }}</span> }
                  </td>
                  <td class="mono faint">
                    @if (g.entries.length === 1) {
                      {{ time(g.entries[0].startTime) }}–{{ time(g.entries[0].endTime) }}
                    }
                  </td>
                  <td class="num mono">{{ g.totalSeconds | duration: 'HH:MM' }}</td>
                  <td class="text-right" style="white-space: nowrap;">
                    @if (g.entries.length === 1) {
                      <button class="btn btn-ghost btn-sm" (click)="continueEntry(g.entries[0])" title="Fortsetzen">▶</button>
                      <button class="btn btn-ghost btn-sm" (click)="duplicate(g.entries[0])" title="Duplizieren">⎘</button>
                      <button class="btn btn-ghost btn-sm" (click)="edit(g.entries[0])" title="Bearbeiten">✎</button>
                      <button class="btn btn-ghost btn-sm" (click)="remove(g.entries[0])" title="Löschen">🗑</button>
                    } @else {
                      <button class="btn btn-ghost btn-sm" (click)="toggleGroup(g.key)"
                              title="{{ expandedGroups().has(g.key) ? 'Einklappen' : 'Aufklappen' }}">
                        {{ expandedGroups().has(g.key) ? 'Einklappen' : 'Details' }}
                      </button>
                    }
                  </td>
                </tr>

                <!-- Sub-rows when expanded -->
                @if (g.entries.length > 1 && expandedGroups().has(g.key)) {
                  @for (e of g.entries; track e.id) {
                    <tr class="sub-row">
                      <td></td>
                      <td class="faint" style="font-size: var(--fs-sm);">
                        @if (!e.billable) { <span class="badge muted">nicht abrechenbar</span> }
                      </td>
                      <td></td>
                      <td class="mono faint" style="font-size: var(--fs-sm);">
                        {{ time(e.startTime) }}–{{ time(e.endTime) }}
                      </td>
                      <td class="num mono" style="font-size: var(--fs-sm);">
                        {{ e.durationSeconds | duration: 'HH:MM' }}
                      </td>
                      <td class="text-right" style="white-space: nowrap;">
                        <button class="btn btn-ghost btn-sm" (click)="continueEntry(e)" title="Fortsetzen">▶</button>
                        <button class="btn btn-ghost btn-sm" (click)="duplicate(e)" title="Duplizieren">⎘</button>
                        <button class="btn btn-ghost btn-sm" (click)="edit(e)" title="Bearbeiten">✎</button>
                        <button class="btn btn-ghost btn-sm" (click)="remove(e)" title="Löschen">🗑</button>
                      </td>
                    </tr>
                  }
                }
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (showDialog()) {
      <div class="dialog-backdrop" (click)="close()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>{{ editingId ? 'Eintrag bearbeiten' : 'Manueller Eintrag' }}</h3>
            <button class="btn btn-ghost btn-icon" (click)="close()">✕</button>
          </div>
          <div class="dialog-body">
            <div class="field"><label>Beschreibung</label><input class="input" [(ngModel)]="form.description" /></div>
            <div class="form-row">
              <div class="field">
                <label>Projekt *</label>
                <select class="select" [(ngModel)]="form.projectId" (ngModelChange)="onProjectChange()">
                  <option [ngValue]="null" disabled>wählen…</option>
                  @for (p of projects(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
                </select>
              </div>
              <div class="field">
                <label>Task</label>
                <select class="select" [(ngModel)]="form.taskId">
                  <option [ngValue]="null">—</option>
                  @for (t of tasks(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="field"><label>Datum</label><input class="input" type="date" [(ngModel)]="date" /></div>
              <div class="field"><label>Start</label><input class="input" type="time" [(ngModel)]="startTime" /></div>
              <div class="field"><label>Ende</label><input class="input" type="time" [(ngModel)]="endTime" /></div>
            </div>
            <div class="field">
              <label>Tags</label>
              <div class="row wrap gap-2">
                @for (t of allTags(); track t.id) {
                  <button type="button" class="badge" [style.outline]="form.tagIds?.includes(t.id) ? '2px solid var(--brand)' : 'none'"
                          [style.color]="t.color || 'var(--text)'" (click)="toggleTag(t.id)">{{ t.name }}</button>
                }
              </div>
            </div>
            <label class="switch"><input type="checkbox" [(ngModel)]="form.billable" /> Abrechenbar</label>
          </div>
          <div class="dialog-footer">
            @if (editingId) {
              <button class="btn btn-danger" style="margin-right: auto" (click)="removeById(editingId)">Löschen</button>
            }
            <button class="btn" (click)="close()">Abbrechen</button>
            <button class="btn btn-primary" (click)="save()" [disabled]="!form.projectId">Speichern</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .expand-col { width: 28px; padding: 0 !important; }
    .group-row td { border-bottom: 1px solid var(--border); }
    .group-expanded td { border-bottom: none; }
    .sub-row td { background: color-mix(in srgb, var(--brand) 3%, var(--surface)); padding-top: var(--sp-1) !important; padding-bottom: var(--sp-1) !important; }
    .sub-row:last-child td { border-bottom: 1px solid var(--border); }
    .text-link { cursor: text; }
  `],
})
export class TimerComponent {
  private readonly api = inject(TimeEntryApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly tagApi = inject(TagApiService);
  protected readonly timerState = inject(TimerStateService);
  private readonly toast = inject(ToastService);
  private readonly shortcuts = inject(KeyboardShortcutService);
  private readonly dialog = inject(DialogService);

  protected readonly todayIso = today();
  protected readonly viewDate = signal(today());
  protected readonly viewDateLabel = computed(() => {
    const iso = this.viewDate();
    if (iso === this.todayIso) return 'Heute';
    const yesterday = toIsoDate(addDays(new Date(this.todayIso), -1));
    if (iso === yesterday) return 'Gestern';
    return new Date(iso + 'T12:00:00').toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
  });

  protected readonly entries = signal<TimeEntry[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly allTags = signal<Tag[]>([]);
  protected readonly recent = signal<RecentCombination[]>([]);
  protected readonly loading = signal(true);
  protected readonly showDialog = signal(false);
  protected readonly editingDescId = signal<string | null>(null);
  protected readonly expandedGroups = signal<Set<string>>(new Set());

  protected readonly totalSeconds = computed(() =>
    this.entries().reduce((s, e) => s + e.durationSeconds, 0),
  );
  protected readonly totalRevenue = computed(() =>
    this.entries()
      .reduce((s, e) => s + Number(e.amountSnapshot ?? 0), 0)
      .toFixed(2),
  );

  protected readonly groupedEntries = computed<EntryGroup[]>(() => {
    const map = new Map<string, EntryGroup>();
    for (const e of this.entries()) {
      const key = `${e.projectId}|${e.taskId ?? ''}|${e.description ?? ''}`;
      const existing = map.get(key);
      if (existing) {
        existing.totalSeconds += e.durationSeconds;
        existing.entries.push(e);
      } else {
        map.set(key, {
          key,
          projectId: e.projectId, projectName: e.projectName, projectColor: e.projectColor,
          taskId: e.taskId, taskName: e.taskName,
          description: e.description, billable: e.billable,
          totalSeconds: e.durationSeconds, entries: [e],
        });
      }
    }
    return [...map.values()];
  });

  protected editingId: string | null = null;
  protected date = today();
  protected startTime = '09:00';
  protected endTime = '10:00';
  protected form: TimeEntryInput = this.empty();

  constructor() {
    this.load();
    this.loadRecent();
    this.projectApi.getAll({ status: 'ACTIVE' }).subscribe((p) => this.projects.set(p));
    this.tagApi.getAll().subscribe((t) => this.allTags.set(t));
    this.shortcuts.commands$.pipe(takeUntilDestroyed()).subscribe((cmd) => {
      if (cmd === 'new-entry') this.openNew();
    });
  }

  private loadRecent(): void {
    this.api.recentCombinations(6).subscribe((r) => this.recent.set(r));
  }

  private empty(): TimeEntryInput {
    return { projectId: '', taskId: null, description: '', startTime: '', endTime: '', billable: true, tagIds: [] };
  }

  load(): void {
    this.loading.set(true);
    const d = this.viewDate();
    this.api.list({ from: d, to: d, size: 200 }).subscribe({
      next: (page) => { this.entries.set(page.content); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  shiftDay(delta: number): void {
    const next = toIsoDate(addDays(new Date(this.viewDate() + 'T12:00:00'), delta));
    if (next > this.todayIso) return;
    this.viewDate.set(next);
    this.load();
  }

  goToday(): void {
    this.viewDate.set(this.todayIso);
    this.load();
  }

  toggleGroup(key: string): void {
    this.expandedGroups.update((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  time(instant: string): string {
    return timeOf(instant);
  }

  openNew(): void {
    this.form = this.empty();
    this.editingId = null;
    this.date = this.viewDate();
    this.startTime = '09:00';
    this.endTime = '10:00';
    this.tasks.set([]);
    this.showDialog.set(true);
  }

  edit(e: TimeEntry): void {
    this.form = {
      projectId: e.projectId,
      taskId: e.taskId,
      description: e.description,
      startTime: e.startTime,
      endTime: e.endTime,
      billable: e.billable,
      tagIds: e.tags.map((t) => t.id),
    };
    this.editingId = e.id;
    this.date = e.entryDate;
    this.startTime = timeOf(e.startTime);
    this.endTime = timeOf(e.endTime);
    this.onProjectChange(e.taskId);
    this.showDialog.set(true);
  }

  onProjectChange(keepTask: string | null = null): void {
    if (!keepTask) this.form.taskId = null;
    this.tasks.set([]);
    if (this.form.projectId) {
      this.taskApi.getForProject(this.form.projectId).subscribe((t) => this.tasks.set(t));
    }
  }

  toggleTag(id: string): void {
    const ids = this.form.tagIds ?? [];
    this.form.tagIds = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }

  close(): void {
    this.showDialog.set(false);
  }

  save(): void {
    if (!this.form.projectId) return;
    const payload: TimeEntryInput = {
      ...this.form,
      startTime: toInstant(this.date, this.startTime),
      endTime: toInstant(this.date, this.endTime),
    };
    const req = this.editingId ? this.api.update(this.editingId, payload) : this.api.create(payload);
    req.subscribe(() => {
      this.toast.success('Gespeichert');
      this.close();
      this.load();
    });
  }

  remove(e: TimeEntry): void {
    this.dialog
      .confirm({ title: 'Eintrag löschen', message: 'Diesen Zeiteintrag löschen?', confirmLabel: 'Löschen', danger: true })
      .then((ok) => {
        if (ok) {
          this.api.delete(e.id).subscribe(() => {
            this.toast.success('Gelöscht');
            this.load();
          });
        }
      });
  }

  removeById(id: string): void {
    this.dialog
      .confirm({ title: 'Eintrag löschen', message: 'Diesen Zeiteintrag löschen?', confirmLabel: 'Löschen', danger: true })
      .then((ok) => {
        if (ok) {
          this.api.delete(id).subscribe(() => {
            this.toast.success('Gelöscht');
            this.close();
            this.load();
          });
        }
      });
  }

  duplicate(e: TimeEntry): void {
    const payload: TimeEntryInput = {
      projectId: e.projectId,
      taskId: e.taskId,
      description: e.description,
      startTime: e.startTime,
      endTime: e.endTime,
      billable: e.billable,
      tagIds: e.tags.map((t) => t.id),
    };
    this.api.create(payload).subscribe(() => {
      this.toast.success('Dupliziert');
      this.load();
    });
  }

  continueEntry(e: TimeEntry): void {
    this.api.continue(e.id).subscribe(() => {
      this.timerState.refresh();
      this.toast.success('Timer fortgesetzt');
    });
  }

  startFromCombo(c: RecentCombination): void {
    if (this.timerState.isRunning()) return;
    this.timerState
      .start({ projectId: c.projectId, taskId: c.taskId, billable: c.billable ?? true })
      .subscribe(() => this.toast.success('Timer gestartet'));
  }

  saveDescription(e: TimeEntry, value: string): void {
    this.editingDescId.set(null);
    const next = value.trim() || null;
    if (next === (e.description ?? null)) return;
    this.api
      .update(e.id, {
        projectId: e.projectId, taskId: e.taskId, description: next,
        startTime: e.startTime, endTime: e.endTime, billable: e.billable,
        tagIds: e.tags.map((t) => t.id),
      })
      .subscribe(() => {
        this.toast.success('Aktualisiert');
        this.load();
      });
  }
}
