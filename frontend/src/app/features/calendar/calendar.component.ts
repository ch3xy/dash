import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
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
  col: number;
  totalCols: number;
}

interface DayColumn {
  date: string;
  label: string;
  blocks: Block[];
}

/** Discriminated union covering all three interaction modes. */
type Interact =
  | { kind: 'create'; colDate: string; startMin: number; endMin: number; active: boolean }
  | { kind: 'move';   entry: TimeEntry; colDate: string; offsetMin: number; currentStart: number; durationMin: number; active: boolean }
  | { kind: 'resize'; entry: TimeEntry; colDate: string; startMin: number; endMin: number; active: boolean };

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
          <div class="cal"
               [class.creating]="interact()?.kind === 'create' && interact()?.active"
               [class.moving]="interact()?.kind === 'move' && interact()?.active"
               [class.resizing]="interact()?.kind === 'resize'">
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
                     (mouseup)="onGridMouseUp()"
                     (touchstart)="onGridTouchStart($event, col.date)">

                  <!-- Hour + half-hour lines -->
                  @for (h of hours; track h) {
                    <div class="hline" [style.top.px]="h * hourPx"></div>
                    <div class="hline hline-half" [style.top.px]="h * hourPx + hourPx / 2"></div>
                  }

                  <!-- Current time indicator -->
                  @if (col.date === todayIso) {
                    <div class="now-line" [style.top.px]="nowTop()">
                      <div class="now-dot"></div>
                    </div>
                  }

                  <!-- Ghost block (create / move / resize) -->
                  @if (ghostForCol(col.date); as g) {
                    <div class="ghost-block"
                         [style.top.px]="g.top"
                         [style.height.px]="g.height">
                      <span class="mono ghost-label">{{ g.label }}</span>
                    </div>
                  }

                  <!-- Existing entries -->
                  @for (b of col.blocks; track b.entry.id) {
                    <div class="block"
                         [class.block-dim]="isInteracting(b.entry.id)"
                         [style.top.px]="b.top"
                         [style.height.px]="b.height"
                         [style.left]="blockLeft(b)"
                         [style.width]="blockWidth(b)"
                         [style.border-left-color]="b.entry.projectColor || 'var(--brand)'"
                         [style.background]="(b.entry.projectColor || 'var(--brand)') + '22'"
                         (mousedown)="onBlockMouseDown($event, b.entry)"
                         (click)="onBlockClick($event, b.entry)"
                         (touchstart)="onBlockTouchStart($event, b.entry)">
                      <div class="b-proj">{{ b.entry.projectName }}</div>
                      @if (b.entry.description && b.height > 30) {
                        <div class="b-desc">{{ b.entry.description }}</div>
                      }
                      @if (b.height > 22) {
                        <div class="b-dur mono">{{ b.entry.durationSeconds | duration: 'HH:MM' }}</div>
                      }
                      <div class="resize-handle"
                           (mousedown)="onResizeMouseDown($event, b.entry, col.date)"
                           (touchstart)="onResizeTouchStart($event, b.entry, col.date)"></div>
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
    .cal.creating { cursor: crosshair; }
    .cal.moving   { cursor: grabbing; }
    .cal.resizing { cursor: ns-resize; }
    .hours { width: 52px; flex-shrink: 0; }
    .day { flex: 1; border-left: 1px solid var(--border); min-width: 0; }
    .today-col { background: color-mix(in srgb, var(--brand) 4%, transparent); }
    .hd { height: 36px; display: flex; align-items: center; justify-content: center;
          font-size: var(--fs-sm); font-weight: 600; border-bottom: 1px solid var(--border);
          position: sticky; top: 0; background: var(--surface); z-index: 2; }
    .today-hd { color: var(--brand); font-weight: 700; }
    .hour-label { font-size: var(--fs-xs); color: var(--text-faint); text-align: right;
                  padding-right: var(--sp-2); box-sizing: border-box; }
    .grid-bg { position: relative; cursor: crosshair; }
    .hline { position: absolute; left: 0; right: 0; border-top: 1px solid var(--border); opacity: 0.5; }
    .hline-half { border-top-style: dashed; opacity: 0.25; }
    .now-line { position: absolute; left: 0; right: 0; border-top: 2px solid #e53e3e; z-index: 3; pointer-events: none; }
    .now-dot { position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%; background: #e53e3e; }
    .block { position: absolute;
             border-left: 3px solid var(--brand);
             border-radius: var(--radius-sm); padding: 2px 4px 10px; overflow: hidden;
             font-size: var(--fs-xs); cursor: grab; z-index: 1; transition: opacity 0.1s; box-sizing: border-box; }
    .block:hover { filter: brightness(0.93); }
    .block-dim { opacity: 0.35; pointer-events: none; }
    .b-proj { font-weight: 600; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .b-desc { color: var(--text-muted); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .b-dur  { color: var(--text-muted); }
    .resize-handle { position: absolute; bottom: 0; left: 0; right: 0; height: 8px;
                     cursor: ns-resize; display: flex; align-items: center; justify-content: center; }
    .resize-handle::after { content: ''; width: 20px; height: 2px; background: currentColor; opacity: 0.3; border-radius: 1px; }
    .ghost-block { position: absolute; left: 2px; right: 2px; z-index: 2;
                   background: color-mix(in srgb, var(--brand) 18%, transparent);
                   border: 2px dashed var(--brand); border-radius: var(--radius-sm);
                   pointer-events: none; padding: 2px 4px; }
    .ghost-label { font-size: var(--fs-xs); font-weight: 600; color: var(--brand); }
  `],
})
export class CalendarComponent implements OnDestroy {
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
  protected readonly interact = signal<Interact | null>(null);
  private lastDragActive = false;
  private interactFromTouch = false;
  private docTouchMove: ((e: TouchEvent) => void) | null = null;
  private docTouchEnd: ((e: TouchEvent) => void) | null = null;

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
      const raw = this.entries()
        .filter((e) => e.entryDate === iso)
        .map((e) => {
          const start = new Date(e.startTime);
          const startMin = start.getHours() * 60 + start.getMinutes();
          const top = (startMin / 60) * HOUR_PX;
          const height = Math.max(HOUR_PX * 0.25, (e.durationSeconds / 3600) * HOUR_PX);
          return { entry: e, top, height, endMin: startMin + Math.round(e.durationSeconds / 60) };
        });
      cols.push({
        date: iso,
        label: date.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        blocks: this.layoutBlocks(raw),
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
      next: (page) => { this.entries.set(page.content); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  shift(days: number): void { this.weekStart = addDays(this.weekStart, days); this.load(); }
  goToday(): void { this.weekStart = startOfWeek(new Date()); this.load(); }

  // ─── Block layout (overlap columns) ────────────────────────────────────────

  private layoutBlocks(
    raw: Array<{ entry: TimeEntry; top: number; height: number; endMin: number }>
  ): Block[] {
    if (!raw.length) return [];
    const sorted = [...raw].sort((a, b) => a.top - b.top);
    const colEnds: number[] = [];
    const assigned: number[] = [];
    for (const b of sorted) {
      const startMin = (b.top / HOUR_PX) * 60;
      let col = colEnds.findIndex((end) => end <= startMin);
      if (col === -1) { col = colEnds.length; colEnds.push(0); }
      colEnds[col] = b.endMin;
      assigned.push(col);
    }
    const totalCols = colEnds.length;
    return sorted.map((b, i) => ({ ...b, col: assigned[i], totalCols }));
  }

  protected blockLeft(b: Block): string {
    return `calc(2px + ${(b.col / b.totalCols) * 100}%)`;
  }

  protected blockWidth(b: Block): string {
    return `calc(${100 / b.totalCols}% - 4px)`;
  }

  protected isInteracting(entryId: string): boolean {
    const ix = this.interact();
    if (!ix || ix.kind === 'create') return false;
    return ix.entry.id === entryId && ix.active;
  }

  // ─── Ghost block ───────────────────────────────────────────────────────────

  protected ghostForCol(colDate: string): { top: number; height: number; label: string } | null {
    const ix = this.interact();
    if (!ix || !ix.active) return null;
    let startMin: number, endMin: number;
    if (ix.kind === 'create') {
      if (ix.colDate !== colDate) return null;
      startMin = ix.startMin; endMin = ix.endMin;
    } else if (ix.kind === 'move') {
      if (ix.colDate !== colDate) return null;
      startMin = ix.currentStart; endMin = ix.currentStart + ix.durationMin;
    } else {
      if (ix.colDate !== colDate) return null;
      startMin = ix.startMin; endMin = ix.endMin;
    }
    return {
      top: (startMin / 60) * HOUR_PX,
      height: Math.max(HOUR_PX * 0.25, ((endMin - startMin) / 60) * HOUR_PX),
      label: `${this.minutesToTime(startMin)} – ${this.minutesToTime(endMin)}`,
    };
  }

  // ─── Grid mouse events ──────────────────────────────────────────────────────

  protected onGridMouseDown(e: MouseEvent, date: string): void {
    if (e.button !== 0) return;
    const startMin = this.snapMinutes(this.yToMinutes(e.offsetY));
    this.interact.set({ kind: 'create', colDate: date, startMin, endMin: startMin + SNAP_MIN, active: false });
  }

  protected onGridMouseMove(e: MouseEvent, colDate: string): void {
    const ix = this.interact();
    if (!ix) return;
    const cursorMin = this.snapMinutes(this.yToMinutes(e.offsetY));
    if (ix.kind === 'create') {
      this.interact.set({ ...ix, colDate, endMin: Math.max(cursorMin, ix.startMin + SNAP_MIN), active: true });
    } else if (ix.kind === 'move') {
      const raw = cursorMin - ix.offsetMin;
      const currentStart = Math.min(Math.max(0, this.snapMinutes(raw)), 24 * 60 - ix.durationMin);
      this.interact.set({ ...ix, colDate, currentStart, active: true });
    } else if (ix.kind === 'resize') {
      if (ix.colDate !== colDate) return;
      this.interact.set({ ...ix, endMin: Math.max(cursorMin, ix.startMin + SNAP_MIN), active: true });
    }
  }

  protected onGridMouseUp(): void {
    this.finaliseInteract();
  }

  @HostListener('window:mouseup')
  onWindowMouseUp(): void {
    if (this.interact()) this.finaliseInteract();
  }

  private finaliseInteract(): void {
    const ix = this.interact();
    this.lastDragActive = ix?.active ?? false;
    this.interact.set(null);
    if (!ix || !ix.active) {
      // Tap/click without drag: open create or edit dialog
      if (this.interactFromTouch) {
        if (ix?.kind === 'move') this.editEntry(ix.entry);
      } else if (ix?.kind === 'create') {
        // Simple click on empty grid: create dialog with 1h default (Clockify behavior)
        const endMin = Math.min(ix.startMin + 60, 24 * 60);
        this.openNewEntry(ix.colDate, ix.startMin, endMin);
      }
      this.interactFromTouch = false;
      return;
    }
    this.interactFromTouch = false;

    if (ix.kind === 'create') {
      this.openNewEntry(ix.colDate, ix.startMin, ix.endMin);
    } else if (ix.kind === 'move') {
      this.patchEntry(ix.entry, ix.colDate, ix.currentStart, ix.currentStart + ix.durationMin);
    } else if (ix.kind === 'resize') {
      this.patchEntry(ix.entry, ix.colDate, ix.startMin, ix.endMin);
    }
  }

  // ─── Block mouse events ─────────────────────────────────────────────────────

  protected onBlockMouseDown(e: MouseEvent, entry: TimeEntry): void {
    if (e.button !== 0) return;
    const blockTop = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    const offsetMin = Math.round(((e.clientY - blockTop) / HOUR_PX) * 60);
    const currentStart = this.entryStartMin(entry);
    const durationMin = Math.round(entry.durationSeconds / 60);
    this.interact.set({ kind: 'move', entry, colDate: entry.entryDate, offsetMin, currentStart, durationMin, active: false });
    e.stopPropagation();
  }

  protected onBlockClick(e: MouseEvent, entry: TimeEntry): void {
    // window:mouseup fires before click; check flag instead of interact() which is already null
    if (!this.lastDragActive) {
      this.editEntry(entry);
    }
    this.lastDragActive = false;
    e.stopPropagation();
  }

  protected onResizeMouseDown(e: MouseEvent, entry: TimeEntry, colDate: string): void {
    if (e.button !== 0) return;
    const startMin = this.entryStartMin(entry);
    const endMin = startMin + Math.round(entry.durationSeconds / 60);
    this.interact.set({ kind: 'resize', entry, colDate, startMin, endMin, active: false });
    e.stopPropagation();
  }

  // ─── Touch events ───────────────────────────────────────────────────────────

  /** Grid tap → open create dialog at tapped time; grid swipe → let browser scroll. */
  protected onGridTouchStart(e: TouchEvent, date: string): void {
    const touch = e.changedTouches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startMin = this.snapMinutes(this.yToMinutes(touch.clientY - rect.top));
    let moved = false;

    const onMove = (mv: TouchEvent) => {
      const t = mv.changedTouches[0];
      if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) moved = true;
    };
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      if (!moved) this.openNewEntry(date, startMin, startMin + 60);
    };
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }

  /** Block touch start → drag to move or tap to edit. */
  protected onBlockTouchStart(e: TouchEvent, entry: TimeEntry): void {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    const blockTop = (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    const offsetMin = Math.round(((touch.clientY - blockTop) / HOUR_PX) * 60);
    this.interact.set({
      kind: 'move', entry, colDate: entry.entryDate,
      offsetMin, currentStart: this.entryStartMin(entry),
      durationMin: Math.round(entry.durationSeconds / 60), active: false,
    });
    this.interactFromTouch = true;
    this.registerTouchListeners();
  }

  /** Resize handle touch → always drag. */
  protected onResizeTouchStart(e: TouchEvent, entry: TimeEntry, colDate: string): void {
    e.preventDefault();
    e.stopPropagation();
    const startMin = this.entryStartMin(entry);
    const endMin = startMin + Math.round(entry.durationSeconds / 60);
    this.interact.set({ kind: 'resize', entry, colDate, startMin, endMin, active: false });
    this.interactFromTouch = true;
    this.registerTouchListeners();
  }

  private registerTouchListeners(): void {
    this.docTouchMove = (e) => this.onDocTouchMove(e);
    this.docTouchEnd = () => this.onDocTouchEnd();
    document.addEventListener('touchmove', this.docTouchMove, { passive: false });
    document.addEventListener('touchend', this.docTouchEnd);
  }

  private removeTouchListeners(): void {
    if (this.docTouchMove) { document.removeEventListener('touchmove', this.docTouchMove); this.docTouchMove = null; }
    if (this.docTouchEnd)  { document.removeEventListener('touchend',  this.docTouchEnd);  this.docTouchEnd  = null; }
  }

  private onDocTouchMove(e: TouchEvent): void {
    const ix = this.interact();
    if (!ix) return;
    e.preventDefault();

    const touch = e.changedTouches[0];
    const { colDate, offsetY } = this.hitTestTouch(touch);
    if (colDate === null || offsetY === null) return;

    const cursorMin = this.snapMinutes(this.yToMinutes(offsetY));
    if (ix.kind === 'create') {
      this.interact.set({ ...ix, colDate, endMin: Math.max(cursorMin, ix.startMin + SNAP_MIN), active: true });
    } else if (ix.kind === 'move') {
      const raw = cursorMin - ix.offsetMin;
      const currentStart = Math.min(Math.max(0, this.snapMinutes(raw)), 24 * 60 - ix.durationMin);
      this.interact.set({ ...ix, colDate, currentStart, active: true });
    } else if (ix.kind === 'resize') {
      if (ix.colDate !== colDate) return;
      this.interact.set({ ...ix, endMin: Math.max(cursorMin, ix.startMin + SNAP_MIN), active: true });
    }
  }

  private onDocTouchEnd(): void {
    this.removeTouchListeners();
    this.finaliseInteract();
  }

  /** Returns the grid-column date and Y offset within the grid at the given touch position. */
  private hitTestTouch(touch: Touch): { colDate: string | null; offsetY: number | null } {
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return { colDate: null, offsetY: null };
    const gridBg = el.closest('.grid-bg') as HTMLElement | null;
    if (!gridBg) return { colDate: null, offsetY: null };
    const offsetY = touch.clientY - gridBg.getBoundingClientRect().top;
    const dayEl = gridBg.closest('.day') as HTMLElement | null;
    const calEl = dayEl?.closest('.cal') as HTMLElement | null;
    if (!dayEl || !calEl) return { colDate: null, offsetY };
    const dayIndex = Array.from(calEl.querySelectorAll('.day')).indexOf(dayEl);
    const cols = this.columns();
    return { colDate: dayIndex >= 0 && dayIndex < cols.length ? cols[dayIndex].date : null, offsetY };
  }

  ngOnDestroy(): void {
    this.removeTouchListeners();
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

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
    this.dialogSvc.confirm({
      title: 'Eintrag löschen', message: 'Diesen Zeiteintrag löschen?',
      confirmLabel: 'Löschen', danger: true,
    }).then((ok) => {
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

  // ─── Patch helper ───────────────────────────────────────────────────────────

  private patchEntry(entry: TimeEntry, colDate: string, startMin: number, endMin: number): void {
    const payload: TimeEntryInput = {
      projectId: entry.projectId,
      taskId: entry.taskId,
      description: entry.description,
      billable: entry.billable,
      tagIds: entry.tags.map((t) => t.id),
      startTime: toInstant(colDate, this.minutesToTime(startMin)),
      endTime: toInstant(colDate, this.minutesToTime(endMin)),
    };
    this.api.update(entry.id, payload).subscribe(() => {
      this.toast.success('Aktualisiert');
      this.load();
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private entryStartMin(entry: TimeEntry): number {
    const d = new Date(entry.startTime);
    return d.getHours() * 60 + d.getMinutes();
  }

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
