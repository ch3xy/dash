import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectApiService } from '../../core/api/project-api.service';
import { TagApiService } from '../../core/api/tag-api.service';
import { TaskApiService } from '../../core/api/task-api.service';
import { TimeEntryApiService } from '../../core/api/time-entry-api.service';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { Project, Tag, Task, TimeEntry, TimeEntryInput, Uuid } from '../../core/models';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { addDays, startOfWeek, timeOf, toInstant, toIsoDate } from '../../shared/utils/date-utils';

const HOUR_PX = 44;
const SNAP_MIN = 15;

interface Block {
  entry: TimeEntry;
  top: number;
  height: number;
}

interface DayColumn {
  date: string;
  label: string;
  blocks: Block[];
}

interface DragState {
  colDate: string;
  startMin: number;
  endMin: number;
  dragging: boolean;
}

@Component({
  selector: 'app-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DurationPipe, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Kalender</h1>
        <div class="row">
          <button class="btn btn-sm" (click)="shift(-7)">←</button>
          <span class="mono">{{ weekLabel() }}</span>
          <button class="btn btn-sm" (click)="shift(7)">→</button>
          <button class="btn btn-sm" (click)="goToday()">Heute</button>
        </div>
      </div>

      @if (loading()) {
        <div class="state"><div class="spinner"></div></div>
      } @else {
        <div class="card" style="overflow: auto;">
          <div class="cal" [class.selecting]="drag()?.dragging">
            <div class="hours">
              <div class="hd"></div>
              @for (h of hours; track h) {
                <div class="hour-label" [style.height.px]="hourPx">{{ h }}:00</div>
              }
            </div>
            @for (col of columns(); track col.date) {
              <div class="day" [class.today-col]="col.date === todayIso">
                <div class="hd" [class.today-hd]="col.date === todayIso">{{ col.label }}</div>
                <div class="grid-bg" [style.height.px]="hourPx * 24"
                     (mousedown)="onGridMouseDown($event, col.date)"
                     (mousemove)="onGridMouseMove($event, col.date)"
                     (mouseup)="onGridMouseUp()">
                  @for (h of hours; track h) {
                    <div class="hline" [style.top.px]="h * hourPx"></div>
                    <div class="hline hline-half" [style.top.px]="h * hourPx + hourPx / 2"></div>
                  }
                  <!-- Current time indicator (today column only) -->
                  @if (col.date === todayIso) {
                    <div class="now-line" [style.top.px]="nowTop()">
                      <div class="now-dot"></div>
                    </div>
                  }
                  <!-- Ghost block while dragging -->
                  @if (drag(); as d) {
                    @if (d.dragging && d.colDate === col.date) {
                      <div class="ghost-block"
                           [style.top.px]="ghostTop(d)"
                           [style.height.px]="ghostHeight(d)">
                        <span class="mono ghost-label">{{ ghostLabel(d) }}</span>
                      </div>
                    }
                  }
                  <!-- Existing entries -->
                  @for (b of col.blocks; track b.entry.id) {
                    <div class="block"
                         [style.top.px]="b.top"
                         [style.height.px]="b.height"
                         [style.border-left-color]="b.entry.projectColor || 'var(--brand)'"
                         [style.background]="(b.entry.projectColor || 'var(--brand)') + '22'"
                         [title]="(b.entry.description || b.entry.projectName) + ' · ' + (b.entry.durationSeconds | duration: 'HH:MM')"
                         (mousedown)="$event.stopPropagation()"
                         (click)="editEntry(b.entry)">
                      <div class="b-proj">{{ b.entry.projectName }}</div>
                      @if (b.entry.description && b.height > 30) {
                        <div class="b-desc">{{ b.entry.description }}</div>
                      }
                      @if (b.height > 22) {
                        <div class="b-dur mono">{{ b.entry.durationSeconds | duration: 'HH:MM' }}</div>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>

    <!-- Entry dialog -->
    @if (showDialog()) {
      <div class="dialog-backdrop" (click)="closeDialog()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>{{ editingId() ? 'Eintrag bearbeiten' : 'Neuer Eintrag' }}</h3>
            <button class="btn btn-ghost btn-icon" (click)="closeDialog()">✕</button>
          </div>
          <div class="dialog-body">
            <div class="field">
              <label>Beschreibung</label>
              <input class="input" [(ngModel)]="form.description"
                     placeholder="Woran hast du gearbeitet?" />
            </div>
            <div class="form-row">
              <div class="field">
                <label>Projekt *</label>
                <select class="select" [(ngModel)]="form.projectId" (ngModelChange)="onProjectChange()">
                  <option [ngValue]="''" disabled>wählen…</option>
                  @for (p of projects(); track p.id) {
                    <option [ngValue]="p.id">{{ p.name }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label>Task</label>
                <select class="select" [(ngModel)]="form.taskId">
                  <option [ngValue]="null">—</option>
                  @for (t of tasks(); track t.id) {
                    <option [ngValue]="t.id">{{ t.name }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="field">
                <label>Datum</label>
                <input class="input" type="date" [(ngModel)]="formDate" />
              </div>
              <div class="field">
                <label>Start</label>
                <input class="input" type="time" [(ngModel)]="formStart" />
              </div>
              <div class="field">
                <label>Ende</label>
                <input class="input" type="time" [(ngModel)]="formEnd" />
              </div>
            </div>
            @if (allTags().length) {
              <div class="field">
                <label>Tags</label>
                <div class="row wrap gap-2">
                  @for (t of allTags(); track t.id) {
                    <button type="button" class="badge"
                            [style.outline]="form.tagIds?.includes(t.id) ? '2px solid var(--brand)' : 'none'"
                            [style.color]="t.color || 'var(--text)'"
                            (click)="toggleTag(t.id)">{{ t.name }}</button>
                  }
                </div>
              </div>
            }
            <label class="switch">
              <input type="checkbox" [(ngModel)]="form.billable" /> Abrechenbar
            </label>
          </div>
          <div class="dialog-footer">
            @if (editingId()) {
              <button class="btn btn-danger" style="margin-right: auto"
                      (click)="removeEntry()">Löschen</button>
            }
            <button class="btn" (click)="closeDialog()">Abbrechen</button>
            <button class="btn btn-primary" (click)="saveEntry()"
                    [disabled]="!form.projectId">Speichern</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cal { display: flex; min-width: 760px; user-select: none; }
    .cal.selecting { cursor: crosshair; }
    .hours { width: 52px; flex-shrink: 0; }
    .day { flex: 1; border-left: 1px solid var(--border); }
    .hd { height: 36px; display: flex; align-items: center; justify-content: center;
          font-size: var(--fs-sm); font-weight: 600; border-bottom: 1px solid var(--border);
          position: sticky; top: 0; background: var(--surface); z-index: 2; }
    .hour-label { font-size: var(--fs-xs); color: var(--text-faint); text-align: right;
                  padding-right: var(--sp-2); box-sizing: border-box; }
    .grid-bg { position: relative; cursor: crosshair; }
    .today-col { background: color-mix(in srgb, var(--brand) 4%, transparent); }
    .today-hd { color: var(--brand); font-weight: 700; }
    .hline { position: absolute; left: 0; right: 0; border-top: 1px solid var(--border); opacity: 0.5; }
    .hline-half { border-top-style: dashed; opacity: 0.25; }
    .now-line { position: absolute; left: 0; right: 0; border-top: 2px solid #e53e3e; z-index: 3; pointer-events: none; }
    .now-dot { position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%; background: #e53e3e; }
    .block { position: absolute; left: 3px; right: 3px;
             background: var(--brand-soft); border-left: 3px solid var(--brand);
             border-radius: var(--radius-sm); padding: 2px 4px; overflow: hidden;
             font-size: var(--fs-xs); cursor: pointer; z-index: 1;
             transition: filter 0.1s; }
    .block:hover { filter: brightness(0.93); }
    .b-proj { font-weight: 600; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .b-desc { color: var(--text-muted); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .b-dur { color: var(--text-muted); }
    .ghost-block { position: absolute; left: 3px; right: 3px; z-index: 2;
                   background: color-mix(in srgb, var(--brand) 18%, transparent);
                   border: 2px dashed var(--brand); border-radius: var(--radius-sm);
                   pointer-events: none; padding: 2px 4px; }
    .ghost-label { font-size: var(--fs-xs); font-weight: 600; color: var(--brand); }
  `],
})
export class CalendarComponent {
  private readonly api = inject(TimeEntryApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly tagApi = inject(TagApiService);
  private readonly toast = inject(ToastService);
  private readonly dialogSvc = inject(DialogService);

  protected readonly hourPx = HOUR_PX;
  protected readonly hours = Array.from({ length: 24 }, (_, i) => i);
  protected readonly loading = signal(true);
  protected weekStart = startOfWeek(new Date());
  protected readonly todayIso = toIsoDate(new Date());
  private readonly nowMinutes = signal(this.currentMinutes());


  private readonly entries = signal<TimeEntry[]>([]);
  protected readonly drag = signal<DragState | null>(null);

  protected readonly projects = signal<Project[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly allTags = signal<Tag[]>([]);
  protected readonly showDialog = signal(false);
  protected readonly editingId = signal<string | null>(null);

  protected form: TimeEntryInput = this.emptyForm();
  protected formDate = '';
  protected formStart = '';
  protected formEnd = '';

  protected readonly weekLabel = computed(() => {
    const end = addDays(this.weekStart, 6);
    return `${this.weekStart.toLocaleDateString('de-AT')} – ${end.toLocaleDateString('de-AT')}`;
  });

  protected readonly columns = computed<DayColumn[]>(() => {
    const cols: DayColumn[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(this.weekStart, i);
      const iso = toIsoDate(date);
      const blocks: Block[] = this.entries()
        .filter((e) => e.entryDate === iso)
        .map((e) => {
          const start = new Date(e.startTime);
          const minutes = start.getHours() * 60 + start.getMinutes();
          const top = (minutes / 60) * HOUR_PX;
          const height = Math.max(HOUR_PX * 0.25, (e.durationSeconds / 3600) * HOUR_PX);
          return { entry: e, top, height };
        });
      cols.push({
        date: iso,
        label: date.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        blocks,
      });
    }
    return cols;
  });

  constructor() {
    this.load();
    this.projectApi.getAll({ status: 'ACTIVE' }).subscribe((p) => this.projects.set(p));
    this.tagApi.getAll().subscribe((t) => this.allTags.set(t));
    setInterval(() => this.nowMinutes.set(this.currentMinutes()), 60_000);
  }

  protected nowTop(): number {
    return (this.nowMinutes() / 60) * HOUR_PX;
  }

  private currentMinutes(): number {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  load(): void {
    this.loading.set(true);
    const from = toIsoDate(this.weekStart);
    const to = toIsoDate(addDays(this.weekStart, 6));
    this.api.list({ from, to, size: 500 }).subscribe({
      next: (page) => {
        this.entries.set(page.content);
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

  // ─── Drag-to-create ─────────────────────────────────────────────────────

  protected onGridMouseDown(e: MouseEvent, date: string): void {
    if (e.button !== 0) return;
    const startMin = this.snapMinutes(this.yToMinutes(e.offsetY));
    this.drag.set({ colDate: date, startMin, endMin: startMin + SNAP_MIN, dragging: false });
  }

  protected onGridMouseMove(e: MouseEvent, date: string): void {
    const d = this.drag();
    if (!d || d.colDate !== date) return;
    const rawMin = this.snapMinutes(this.yToMinutes(e.offsetY));
    const endMin = Math.max(rawMin, d.startMin + SNAP_MIN);
    this.drag.set({ ...d, endMin, dragging: true });
  }

  protected onGridMouseUp(): void {
    const d = this.drag();
    this.drag.set(null);
    if (d?.dragging) {
      this.openNewEntry(d.colDate, d.startMin, d.endMin);
    }
  }

  // Catches mouseup outside the grid column so dragging to a column edge still opens the dialog.
  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    const d = this.drag();
    if (!d) return; // already handled by onGridMouseUp
    this.drag.set(null);
    if (d.dragging) {
      this.openNewEntry(d.colDate, d.startMin, d.endMin);
    }
  }

  protected ghostTop(d: DragState): number {
    return (d.startMin / 60) * HOUR_PX;
  }

  protected ghostHeight(d: DragState): number {
    return ((d.endMin - d.startMin) / 60) * HOUR_PX;
  }

  protected ghostLabel(d: DragState): string {
    return `${this.minutesToTime(d.startMin)} – ${this.minutesToTime(d.endMin)}`;
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────

  private openNewEntry(date: string, startMin: number, endMin: number): void {
    this.form = this.emptyForm();
    this.editingId.set(null);
    this.formDate = date;
    this.formStart = this.minutesToTime(startMin);
    this.formEnd = this.minutesToTime(endMin);
    this.tasks.set([]);
    this.showDialog.set(true);
  }

  protected editEntry(entry: TimeEntry): void {
    this.form = {
      projectId: entry.projectId,
      taskId: entry.taskId,
      description: entry.description,
      startTime: entry.startTime,
      endTime: entry.endTime,
      billable: entry.billable,
      tagIds: entry.tags.map((t) => t.id),
    };
    this.editingId.set(entry.id);
    this.formDate = entry.entryDate;
    this.formStart = timeOf(entry.startTime);
    this.formEnd = timeOf(entry.endTime);
    this.tasks.set([]);
    if (entry.projectId) {
      this.taskApi.getForProject(entry.projectId).subscribe((t) => this.tasks.set(t));
    }
    this.showDialog.set(true);
  }

  protected onProjectChange(): void {
    this.form.taskId = null;
    this.tasks.set([]);
    if (this.form.projectId) {
      this.taskApi.getForProject(this.form.projectId).subscribe((t) => this.tasks.set(t));
    }
  }

  protected toggleTag(id: Uuid): void {
    const ids = this.form.tagIds ?? [];
    this.form.tagIds = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }

  protected saveEntry(): void {
    if (!this.form.projectId) return;
    const payload: TimeEntryInput = {
      ...this.form,
      startTime: toInstant(this.formDate, this.formStart),
      endTime: toInstant(this.formDate, this.formEnd),
    };
    const id = this.editingId();
    const req = id ? this.api.update(id, payload) : this.api.create(payload);
    req.subscribe(() => {
      this.toast.success(id ? 'Aktualisiert' : 'Gespeichert');
      this.closeDialog();
      this.load();
    });
  }

  protected removeEntry(): void {
    const id = this.editingId();
    if (!id) return;
    this.dialogSvc
      .confirm({
        title: 'Eintrag löschen',
        message: 'Diesen Zeiteintrag löschen?',
        confirmLabel: 'Löschen',
        danger: true,
      })
      .then((ok) => {
        if (ok) {
          this.api.delete(id).subscribe(() => {
            this.toast.success('Gelöscht');
            this.closeDialog();
            this.load();
          });
        }
      });
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.editingId.set(null);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private yToMinutes(y: number): number {
    return (y / HOUR_PX) * 60;
  }

  private snapMinutes(minutes: number): number {
    return Math.round(minutes / SNAP_MIN) * SNAP_MIN;
  }

  private minutesToTime(minutes: number): string {
    const clamped = Math.min(Math.max(0, minutes), 23 * 60 + 45);
    return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
  }

  private emptyForm(): TimeEntryInput {
    return { projectId: '', taskId: null, description: '', startTime: '', endTime: '', billable: true, tagIds: [] };
  }
}
