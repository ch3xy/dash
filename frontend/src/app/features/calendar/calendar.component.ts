import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ProjectApiService } from '../../core/api/project-api.service';
import { TagApiService } from '../../core/api/tag-api.service';
import { TaskApiService } from '../../core/api/task-api.service';
import { TimeEntryApiService } from '../../core/api/time-entry-api.service';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { Project, Tag, Task, TimeEntry, TimeEntryInput, Uuid } from '../../core/models';
import { loadViewSetting, persistQueryParams, saveViewSetting } from '../../core/view-state';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { DateRange, parseIsoDate, weekRange } from '../../shared/utils/date-range';
import { addDays, timeOf, toInstant, toIsoDate } from '../../shared/utils/date-utils';
import { LucideLock, LucideUnfoldVertical, LucideX, LucideZoomIn, LucideZoomOut } from '@lucide/angular';
import { MonthLockStateService } from '../../core/month-lock-state.service';
import { MonthLockedBannerComponent } from '../../shared/components/month-locked-banner.component';

const SNAP_MIN = 15;
const DAY_MIN = 24 * 60;
/** Default zoom: this hour range fills the visible grid height. */
const FIT_FROM = 7;
const FIT_TO = 18;
const HEADER_PX = 48;
const MIN_HOUR_PX = 24;
const ZOOM_STEP = 1.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
/** Free strip on the right of each day for drawing entries that overlap existing ones. */
const GUTTER_PX = 14;
const DRAG_THRESHOLD_PX = 4;

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
  totalSeconds: number;
  blocks: Block[];
}

/** Discriminated union covering all three interaction modes. */
type Interact =
  | { kind: 'create'; colDate: string; anchorMin: number; startMin: number; endMin: number; active: boolean }
  | { kind: 'move';   entry: TimeEntry; colDate: string; offsetMin: number; startMin: number; durationMin: number; active: boolean }
  | { kind: 'resize'; entry: TimeEntry; colDate: string; startMin: number; endMin: number; active: boolean };

@Component({
  selector: 'app-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DurationPipe, FormsModule, DateRangePickerComponent, MonthLockedBannerComponent, LucideLock, LucideX, LucideZoomIn, LucideZoomOut, LucideUnfoldVertical],
  template: `
    <div class="page cal-page">
      <div class="page-header">
        <h1>Kalender</h1>
        <div class="page-controls">
          <div class="row zoom" role="group" aria-label="Zoom">
            <button type="button" class="btn btn-sm btn-icon" (click)="zoomBy(1 / ZOOM_STEP)" [disabled]="zoom() <= MIN_ZOOM"
                    title="Verkleinern" aria-label="Verkleinern"><svg lucideZoomOut [size]="16"></svg></button>
            <button type="button" class="btn btn-sm btn-icon" (click)="fitView()"
                    title="07:00–18:00 einpassen" aria-label="07:00 bis 18:00 einpassen"><svg lucideUnfoldVertical [size]="16"></svg></button>
            <button type="button" class="btn btn-sm btn-icon" (click)="zoomBy(ZOOM_STEP)" [disabled]="zoom() >= MAX_ZOOM"
                    title="Vergrößern" aria-label="Vergrößern"><svg lucideZoomIn [size]="16"></svg></button>
          </div>
          <app-date-range-picker mode="week" ariaLabel="Woche" [range]="week()" (rangeChange)="setWeek($event)" />
        </div>
      </div>

      <app-month-locked-banner [dates]="[week().from, week().to]" />

      <div class="card cal-scroll" #scroller [class.refreshing]="loading() && loaded()">
        @if (!loaded()) {
          <div class="state"><div class="spinner"></div></div>
        } @else {
          <div class="cal"
               [class.creating]="interact()?.kind === 'create' && interact()?.active"
               [class.moving]="interact()?.kind === 'move' && interact()?.active"
               [class.resizing]="interact()?.kind === 'resize' && interact()?.active">
            <div class="hours">
              <div class="hd"></div>
              @for (h of hours; track h) {
                <div class="hour-label" [style.height.px]="hourPx()">{{ h }}:00</div>
              }
            </div>

            @for (col of columns(); track col.date) {
              <div class="day" [class.today-col]="col.date === todayIso" [class.locked-col]="isLocked(col.date)">
                <div class="hd" [class.today-hd]="col.date === todayIso">
                  <div class="hd-date">
                    @if (isLocked(col.date)) { <svg lucideLock [size]="12" aria-label="abgeschlossen"></svg> }
                    {{ col.label }}
                  </div>
                  <div class="hd-total mono">{{ col.totalSeconds | duration: 'HH:MM' }}</div>
                </div>
                <div class="grid-bg" [attr.data-date]="col.date" [style.height.px]="hourPx() * 24"
                     (mousedown)="onGridMouseDown($event, col.date)"
                     (touchstart)="onGridTouchStart($event, col.date)">

                  <!-- Hour + half-hour lines -->
                  @for (h of hours; track h) {
                    <div class="hline" [style.top.px]="h * hourPx()"></div>
                    <div class="hline hline-half" [style.top.px]="(h + 0.5) * hourPx()"></div>
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
                      <span class="mono ghost-dur">{{ g.durationSeconds | duration: 'HH:MM' }}</span>
                    </div>
                  }

                  <!-- Existing entries -->
                  @for (b of col.blocks; track b.entry.id) {
                    <div class="block"
                         tabindex="0"
                         [attr.aria-label]="b.entry.projectName + ', ' + time(b.entry.startTime) + ' bis ' + time(b.entry.endTime)"
                         [class.block-dim]="isInteracting(b.entry.id)"
                         [style.top.px]="b.top"
                         [style.height.px]="b.height"
                         [style.left]="blockLeft(b)"
                         [style.width]="blockWidth(b)"
                         [style.border-left-color]="b.entry.projectColor || 'var(--brand)'"
                         [style.background]="(b.entry.projectColor || 'var(--brand)') + '22'"
                         (mousedown)="onBlockMouseDown($event, b.entry)"
                         (touchstart)="onBlockTouchStart($event, b.entry)"
                         (keydown.enter)="editEntry(b.entry)">
                      <div class="b-proj">{{ b.entry.projectName }}</div>
                      @if (b.entry.description && b.height > 30) {
                        <div class="b-desc">{{ b.entry.description }}</div>
                      }
                      @if (b.height > 34) {
                        <div class="b-dur mono">{{ b.entry.durationSeconds | duration: 'HH:MM' }}</div>
                      }
                      @if (!isLocked(b.entry.entryDate)) {
                        <div class="resize-handle"
                             (mousedown)="onResizeMouseDown($event, b.entry, col.date)"
                             (touchstart)="onResizeTouchStart($event, b.entry, col.date)"></div>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <!-- Entry dialog -->
    @if (showDialog()) {
      <div class="dialog-backdrop" (click)="closeDialog()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>{{ formLocked() ? 'Eintrag (abgeschlossen)' : editingId() ? 'Eintrag bearbeiten' : 'Neuer Eintrag' }}</h3>
            <button class="btn btn-ghost btn-icon" (click)="closeDialog()" aria-label="Schließen"><svg lucideX></svg></button>
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
            @if (formLocked()) {
              <span class="faint row gap-2" style="margin-right: auto">
                <svg lucideLock [size]="14"></svg> Monat abgeschlossen – nur lesend
              </span>
              <button class="btn" (click)="closeDialog()">Schließen</button>
            } @else {
              @if (editingId()) {
                <button class="btn btn-danger" style="margin-right: auto"
                        (click)="removeEntry()">Löschen</button>
              }
              <button class="btn" (click)="closeDialog()">Abbrechen</button>
              <button class="btn btn-primary" (click)="saveEntry()"
                      [disabled]="!form.projectId">Speichern</button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
    /* The page fills the viewport; only the grid scrolls, so controls and day headers stay visible. */
    .cal-page { height: 100%; display: flex; flex-direction: column; box-sizing: border-box; }
    .cal-page .page-header { flex-shrink: 0; }
    .zoom { gap: var(--sp-1); }
    .cal-scroll { flex: 1; min-height: 0; overflow: auto; position: relative; }
    .cal-scroll.refreshing .cal { opacity: 0.6; transition: opacity 0.15s; }
    .cal { display: flex; min-width: 760px; user-select: none; }
    .cal.creating { cursor: crosshair; }
    .cal.moving, .cal.moving .block { cursor: grabbing; }
    .cal.resizing, .cal.resizing .block { cursor: ns-resize; }
    .hours { width: 52px; flex-shrink: 0; position: sticky; left: 0; z-index: 6; background: var(--surface); }
    .day { flex: 1; border-left: 1px solid var(--border); min-width: 0; }
    .today-col { background: color-mix(in srgb, var(--brand) 4%, transparent); }
    .locked-col .grid-bg { cursor: default; background: repeating-linear-gradient(135deg, transparent 0 8px, color-mix(in srgb, var(--text) 3%, transparent) 8px 16px); }
    .locked-col .hd { color: var(--text-muted); }
    .hd { height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-size: var(--fs-sm); font-weight: 600; border-bottom: 1px solid var(--border);
          position: sticky; top: 0; background: var(--surface); z-index: 5; }
    .hours .hd { z-index: 7; }
    .today-hd { color: var(--brand); font-weight: 700; }
    .hd-date { display: flex; align-items: center; gap: 4px; }
    .hd-total { margin-top: 4px; font-size: var(--fs-xs); font-weight: 500; color: var(--text-muted); }
    .hour-label { font-size: var(--fs-xs); color: var(--text-faint); text-align: right;
                  padding-right: var(--sp-2); box-sizing: border-box; transform: translateY(-0.6em); }
    .hours .hour-label:nth-child(2) { transform: none; }
    .grid-bg { position: relative; cursor: crosshair; }
    .hline { position: absolute; left: 0; right: 0; border-top: 1px solid var(--border); opacity: 0.5; pointer-events: none; }
    .hline-half { border-top-style: dashed; opacity: 0.25; }
    .now-line { position: absolute; left: 0; right: 0; border-top: 2px solid #e53e3e; z-index: 3; pointer-events: none; }
    .now-dot { position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%; background: #e53e3e; }
    .block { position: absolute;
             border-left: 3px solid var(--brand);
             border-radius: var(--radius-sm); padding: 2px 4px 10px; overflow: hidden;
             font-size: var(--fs-xs); cursor: grab; z-index: 1; transition: opacity 0.1s; box-sizing: border-box; }
    .block:hover { filter: brightness(0.93); }
    .block:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
    .block-dim { opacity: 0.35; pointer-events: none; }
    .b-proj { font-weight: 600; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .b-desc { color: var(--text-muted); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .b-dur  { position: absolute; right: 4px; bottom: 2px; color: var(--text-muted); pointer-events: none; }
    .resize-handle { position: absolute; bottom: 0; left: 0; right: 0; height: 8px;
                     cursor: ns-resize; display: flex; align-items: center; justify-content: center; }
    .resize-handle::after { content: ''; width: 20px; height: 2px; background: currentColor; opacity: 0.3; border-radius: 1px; }
    .ghost-block { position: absolute; left: 2px; right: 2px; z-index: 2;
                   background: color-mix(in srgb, var(--brand) 18%, transparent);
                   border: 2px dashed var(--brand); border-radius: var(--radius-sm);
                   pointer-events: none; padding: 2px 4px; box-sizing: border-box; }
    .ghost-label { font-size: var(--fs-xs); font-weight: 600; color: var(--brand); }
    .ghost-dur { position: absolute; right: 4px; bottom: 2px; font-size: var(--fs-xs); font-weight: 600; color: var(--brand); }
  `],
})
export class CalendarComponent implements OnDestroy {
  private readonly api = inject(TimeEntryApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly tagApi = inject(TagApiService);
  private readonly toast = inject(ToastService);
  private readonly dialogSvc = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly ZOOM_STEP = ZOOM_STEP;
  protected readonly MIN_ZOOM = MIN_ZOOM;
  protected readonly MAX_ZOOM = MAX_ZOOM;
  protected readonly hours = Array.from({ length: 24 }, (_, i) => i);
  /** True while a request runs; the grid stays visible (dimmed) after the first load. */
  protected readonly loading = signal(true);
  protected readonly loaded = signal(false);
  /** Displayed Mon–Sun week from the URL (?week=YYYY-MM-DD), defaulting to the current week. */
  protected readonly week = toSignal(
    this.route.queryParamMap.pipe(map((p) => weekRange(p.get('week') || toIsoDate(new Date())))),
    { initialValue: weekRange(toIsoDate(new Date())) },
  );

  protected get weekStart(): Date {
    return parseIsoDate(this.week().from);
  }
  protected readonly todayIso = toIsoDate(new Date());
  private readonly nowMinutes = signal(this.currentMinutes());
  private readonly nowTimer = setInterval(() => this.nowMinutes.set(this.currentMinutes()), 60_000);

  // ─── Zoom ────────────────────────────────────────────────────────────────────
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  /** Hour height at which FIT_FROM–FIT_TO exactly fills the visible grid area. */
  private readonly fitHourPx = signal(44);
  /** Factor on top of the fit size; 1 = default view showing 07:00–18:00. */
  protected readonly zoom = signal(loadViewSetting('calendar.zoom', 1));
  protected readonly hourPx = computed(() => Math.max(MIN_HOUR_PX, this.fitHourPx() * this.zoom()));
  private resizeObserver: ResizeObserver | null = null;
  private initialScrollDone = false;

  private readonly entries = signal<TimeEntry[]>([]);
  protected readonly interact = signal<Interact | null>(null);
  /** Pointer position at drag start; movement below DRAG_THRESHOLD_PX counts as a click. */
  private dragOrigin = { x: 0, y: 0 };
  private detachDragListeners: (() => void) | null = null;

  protected readonly projects = signal<Project[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly allTags = signal<Tag[]>([]);
  protected readonly showDialog = signal(false);
  protected readonly editingId = signal<string | null>(null);
  private readonly lockState = inject(MonthLockStateService);

  protected isLocked(date: string): boolean {
    return this.lockState.isLocked(date);
  }

  /** The open dialog shows an entry of a closed month: read-only. */
  protected formLocked(): boolean {
    return !!this.editingId() && this.isLocked(this.formDate);
  }

  protected form: TimeEntryInput = this.emptyForm();
  protected formDate = '';
  protected formStart = '';
  protected formEnd = '';

  protected readonly columns = computed<DayColumn[]>(() => {
    const hourPx = this.hourPx();
    const cols: DayColumn[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(this.weekStart, i);
      const iso = toIsoDate(date);
      const raw = this.entries()
        .filter((e) => e.entryDate === iso)
        .map((e) => {
          const startMin = this.entryStartMin(e);
          const endMin = Math.min(DAY_MIN, startMin + Math.max(1, Math.round(e.durationSeconds / 60)));
          return { entry: e, startMin, endMin };
        });
      cols.push({
        date: iso,
        label: date.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        totalSeconds: raw.reduce((sum, r) => sum + r.entry.durationSeconds, 0),
        blocks: this.layoutBlocks(raw, hourPx),
      });
    }
    return cols;
  });

  constructor() {
    persistQueryParams('calendar');
    effect(() => {
      this.week();
      untracked(() => this.load());
    });
    // Track the visible grid height so the default zoom always shows FIT_FROM–FIT_TO.
    effect(() => {
      const el = this.scroller()?.nativeElement;
      this.resizeObserver?.disconnect();
      if (!el) return;
      this.resizeObserver = new ResizeObserver(() => this.measure(el));
      this.resizeObserver.observe(el);
      this.measure(el);
    });
    // Scroll to FIT_FROM once the grid has rendered for the first time.
    effect(() => {
      if (!this.loaded() || this.initialScrollDone) return;
      afterNextRender(() => {
        const el = this.scroller()?.nativeElement;
        if (!el || this.initialScrollDone) return;
        el.scrollTop = FIT_FROM * this.hourPx();
        this.initialScrollDone = true;
      }, { injector: this.injector });
    });
    this.projectApi.getAll({ status: 'ACTIVE' }).subscribe((p) => this.projects.set(p));
    this.tagApi.getAll().subscribe((t) => this.allTags.set(t));
  }

  private measure(el: HTMLElement): void {
    const visible = el.clientHeight - HEADER_PX;
    if (visible > 0) this.fitHourPx.set(visible / (FIT_TO - FIT_FROM));
  }

  /** Zooms around the time currently at the top of the viewport. */
  protected zoomBy(factor: number): void {
    this.setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom() * factor)));
  }

  /** Back to the default: 07:00–18:00 fills the view. */
  protected fitView(): void {
    this.setZoom(1, FIT_FROM * 60);
  }

  private setZoom(zoom: number, topMin?: number): void {
    const el = this.scroller()?.nativeElement;
    const anchor = topMin ?? (el ? (el.scrollTop / this.hourPx()) * 60 : FIT_FROM * 60);
    this.zoom.set(zoom);
    saveViewSetting('calendar.zoom', zoom);
    afterNextRender(() => {
      if (el) el.scrollTop = (anchor / 60) * this.hourPx();
    }, { injector: this.injector });
  }

  protected nowTop(): number {
    return (this.nowMinutes() / 60) * this.hourPx();
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
        this.loaded.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.loaded.set(true);
      },
    });
  }

  protected setWeek(range: DateRange): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { week: range.from }, queryParamsHandling: 'merge' });
  }

  protected time(instant: string): string {
    return timeOf(instant);
  }

  // ─── Block layout (overlap columns) ────────────────────────────────────────

  /**
   * Places overlapping entries side by side. Columns are counted per cluster of mutually
   * overlapping entries, so an unrelated overlap elsewhere in the day doesn't narrow every block.
   */
  private layoutBlocks(raw: Array<{ entry: TimeEntry; startMin: number; endMin: number }>, hourPx: number): Block[] {
    const sorted = [...raw].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
    const result: Block[] = [];
    let cluster: Block[] = [];
    let colEnds: number[] = [];
    let clusterEnd = -1;
    const flush = () => {
      for (const b of cluster) b.totalCols = colEnds.length;
      result.push(...cluster);
      cluster = [];
      colEnds = [];
    };
    for (const r of sorted) {
      if (r.startMin >= clusterEnd) flush();
      let col = colEnds.findIndex((end) => end <= r.startMin);
      if (col === -1) { col = colEnds.length; colEnds.push(0); }
      colEnds[col] = r.endMin;
      clusterEnd = Math.max(clusterEnd, r.endMin);
      cluster.push({
        entry: r.entry,
        top: (r.startMin / 60) * hourPx,
        height: Math.max(hourPx * 0.25, ((r.endMin - r.startMin) / 60) * hourPx),
        col,
        totalCols: 1,
      });
    }
    flush();
    return result;
  }

  // Blocks leave a free strip on the right so a new (overlapping) entry can always be drawn there.
  protected blockLeft(b: Block): string {
    return `calc(2px + (100% - ${GUTTER_PX}px) * ${b.col / b.totalCols})`;
  }

  protected blockWidth(b: Block): string {
    return `calc((100% - ${GUTTER_PX}px) / ${b.totalCols} - 2px)`;
  }

  protected isInteracting(entryId: string): boolean {
    const ix = this.interact();
    if (!ix || ix.kind === 'create') return false;
    return ix.entry.id === entryId && ix.active;
  }

  // ─── Ghost block ───────────────────────────────────────────────────────────

  protected ghostForCol(colDate: string): { top: number; height: number; label: string; durationSeconds: number } | null {
    const ix = this.interact();
    if (!ix || !ix.active || ix.colDate !== colDate) return null;
    const startMin = ix.startMin;
    const endMin = ix.kind === 'move' ? ix.startMin + ix.durationMin : ix.endMin;
    const hourPx = this.hourPx();
    return {
      top: (startMin / 60) * hourPx,
      height: Math.max(hourPx * 0.25, ((endMin - startMin) / 60) * hourPx),
      label: `${this.minutesToTime(startMin)} – ${this.minutesToTime(endMin)}`,
      durationSeconds: (endMin - startMin) * 60,
    };
  }

  // ─── Pointer interaction (mouse + touch) ────────────────────────────────────

  protected onGridMouseDown(e: MouseEvent, date: string): void {
    if (e.button !== 0 || this.isLocked(date)) return;
    e.preventDefault();
    const hit = this.hitTest(e.clientX, e.clientY);
    const anchorMin = Math.min(DAY_MIN - SNAP_MIN, this.snapDown(hit?.minutes ?? 0));
    this.begin(
      { kind: 'create', colDate: date, anchorMin, startMin: anchorMin, endMin: anchorMin + SNAP_MIN, active: false },
      e.clientX, e.clientY, false,
    );
  }

  protected onBlockMouseDown(e: MouseEvent, entry: TimeEntry): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // Entries of a closed month cannot be moved; a click only opens the read-only dialog.
    if (this.isLocked(entry.entryDate)) {
      this.editEntry(entry);
      return;
    }
    this.begin(this.moveInteract(entry, e.clientY), e.clientX, e.clientY, false);
  }

  protected onResizeMouseDown(e: MouseEvent, entry: TimeEntry, colDate: string): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.begin(this.resizeInteract(entry, colDate), e.clientX, e.clientY, false);
  }

  /** Grid tap → open create dialog at tapped time; grid swipe → let browser scroll. */
  protected onGridTouchStart(e: TouchEvent, date: string): void {
    if (this.isLocked(date)) return;
    const touch = e.changedTouches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const hit = this.hitTest(startX, startY);
    const startMin = Math.min(DAY_MIN - SNAP_MIN, this.snapDown(hit?.minutes ?? 0));
    let moved = false;

    const onMove = (mv: TouchEvent) => {
      const t = mv.changedTouches[0];
      if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) moved = true;
    };
    const onEnd = () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      if (!moved) this.openNewEntry(date, startMin, Math.min(startMin + 60, DAY_MIN));
    };
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onEnd);
  }

  /** Block touch → drag to move or tap to edit. */
  protected onBlockTouchStart(e: TouchEvent, entry: TimeEntry): void {
    e.preventDefault();
    e.stopPropagation();
    if (this.isLocked(entry.entryDate)) {
      this.editEntry(entry);
      return;
    }
    const t = e.changedTouches[0];
    this.begin(this.moveInteract(entry, t.clientY), t.clientX, t.clientY, true);
  }

  /** Resize handle touch → always drag. */
  protected onResizeTouchStart(e: TouchEvent, entry: TimeEntry, colDate: string): void {
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    this.begin(this.resizeInteract(entry, colDate), t.clientX, t.clientY, true);
  }

  private moveInteract(entry: TimeEntry, clientY: number): Interact {
    const startMin = this.entryStartMin(entry);
    const hit = this.hitTest(0, clientY, entry.entryDate);
    return {
      kind: 'move', entry, colDate: entry.entryDate,
      offsetMin: hit ? hit.minutes - startMin : 0,
      startMin, durationMin: Math.max(SNAP_MIN, Math.round(entry.durationSeconds / 60)), active: false,
    };
  }

  private resizeInteract(entry: TimeEntry, colDate: string): Extract<Interact, { kind: 'resize' }> {
    const startMin = this.entryStartMin(entry);
    const endMin = Math.min(DAY_MIN, startMin + Math.round(entry.durationSeconds / 60));
    return { kind: 'resize', entry, colDate, startMin, endMin, active: false };
  }

  /** Starts a drag; move/up are tracked on the document so leaving a column or block doesn't break it. */
  private begin(ix: Interact, x: number, y: number, touch: boolean): void {
    this.endDrag();
    this.dragOrigin = { x, y };
    this.interact.set(ix);
    const cancel = () => { this.endDrag(); this.interact.set(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); cancel(); } };
    document.addEventListener('keydown', onKey, true);
    if (touch) {
      const move = (e: TouchEvent) => { e.preventDefault(); const t = e.changedTouches[0]; this.onDragMove(t.clientX, t.clientY); };
      const end = () => this.finishDrag();
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', end);
      document.addEventListener('touchcancel', cancel);
      this.detachDragListeners = () => {
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
        document.removeEventListener('touchcancel', cancel);
        document.removeEventListener('keydown', onKey, true);
      };
    } else {
      const move = (e: MouseEvent) => this.onDragMove(e.clientX, e.clientY);
      const up = () => this.finishDrag();
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
      this.detachDragListeners = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.removeEventListener('keydown', onKey, true);
      };
    }
  }

  private endDrag(): void {
    this.detachDragListeners?.();
    this.detachDragListeners = null;
  }

  private onDragMove(x: number, y: number): void {
    const ix = this.interact();
    if (!ix) return;
    if (!ix.active && Math.hypot(x - this.dragOrigin.x, y - this.dragOrigin.y) < DRAG_THRESHOLD_PX) return;
    // Creating and resizing stay in their day; moving follows the pointer across days.
    const hit = this.hitTest(x, y, ix.kind === 'move' ? undefined : ix.colDate);
    if (!hit) return;
    if (ix.kind === 'create') {
      // Dragging upwards keeps the anchor slot as the end, so both directions work.
      const cursor = this.snap(hit.minutes);
      const startMin = Math.min(ix.anchorMin, cursor);
      const endMin = Math.min(DAY_MIN, Math.max(ix.anchorMin + SNAP_MIN, cursor));
      this.interact.set({ ...ix, startMin, endMin, active: true });
    } else if (ix.kind === 'move') {
      const maxStart = Math.max(0, DAY_MIN - ix.durationMin);
      const startMin = Math.min(Math.max(0, this.snap(hit.minutes - ix.offsetMin)), maxStart);
      this.interact.set({ ...ix, colDate: hit.colDate, startMin, active: true });
    } else {
      const endMin = Math.min(DAY_MIN, Math.max(ix.startMin + SNAP_MIN, this.snap(hit.minutes)));
      this.interact.set({ ...ix, endMin, active: true });
    }
  }

  private finishDrag(): void {
    const ix = this.interact();
    this.endDrag();
    this.interact.set(null);
    if (!ix) return;

    if (!ix.active) {
      // Click/tap without drag: empty grid → new entry (1 h, like Clockify); block → edit.
      if (ix.kind === 'create') this.openNewEntry(ix.colDate, ix.anchorMin, Math.min(ix.anchorMin + 60, DAY_MIN));
      else if (ix.kind === 'move') this.editEntry(ix.entry);
      return;
    }

    if (ix.kind === 'create') {
      this.openNewEntry(ix.colDate, ix.startMin, ix.endMin);
    } else if (ix.kind === 'move') {
      if (ix.colDate !== ix.entry.entryDate || ix.startMin !== this.entryStartMin(ix.entry)) {
        this.patchEntry(ix.entry, ix.colDate, ix.startMin, ix.startMin + ix.durationMin);
      }
    } else if (ix.endMin !== this.resizeInteract(ix.entry, ix.colDate).endMin) {
      this.patchEntry(ix.entry, ix.colDate, ix.startMin, ix.endMin);
    }
  }

  /**
   * Maps a viewport position to a day column and minute of day. Outside the grid the nearest
   * column is used, so dragging past the edges clamps instead of being ignored.
   */
  private hitTest(x: number, y: number, fixedDate?: string): { colDate: string; minutes: number } | null {
    const grids = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.grid-bg'));
    let best: HTMLElement | null = null;
    let bestDist = Infinity;
    for (const g of grids) {
      if (fixedDate && g.dataset['date'] !== fixedDate) continue;
      const r = g.getBoundingClientRect();
      const dist = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (dist < bestDist) { best = g; bestDist = dist; }
    }
    if (!best) return null;
    const rect = best.getBoundingClientRect();
    const minutes = Math.min(DAY_MIN, Math.max(0, ((y - rect.top) / this.hourPx()) * 60));
    return { colDate: best.dataset['date']!, minutes };
  }

  ngOnDestroy(): void {
    this.endDrag();
    this.resizeObserver?.disconnect();
    clearInterval(this.nowTimer);
  }

  // ─── Dialog ─────────────────────────────────────────────────────────────────

  private openNewEntry(date: string, startMin: number, endMin: number): void {
    this.form = this.emptyForm();
    this.editingId.set(null);
    this.formDate = date;
    this.formStart = this.minutesToTime(startMin);
    this.formEnd = this.minutesToTime(Math.min(endMin, DAY_MIN - 1));
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

  /** Saves a moved/resized entry. The grid updates immediately and is reloaded from the server afterwards. */
  private patchEntry(entry: TimeEntry, colDate: string, startMin: number, endMin: number): void {
    const startTime = this.instantAt(colDate, startMin);
    const endTime = this.instantAt(colDate, endMin);
    const payload: TimeEntryInput = {
      projectId: entry.projectId,
      taskId: entry.taskId,
      description: entry.description,
      billable: entry.billable,
      tagIds: entry.tags.map((t) => t.id),
      startTime,
      endTime,
    };
    this.entries.update((list) => list.map((e) => e.id === entry.id
      ? { ...e, entryDate: colDate, startTime, endTime, durationSeconds: (endMin - startMin) * 60 }
      : e));
    this.api.update(entry.id, payload).subscribe({
      next: () => {
        this.toast.success('Aktualisiert');
        this.load();
      },
      error: () => this.load(),
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private entryStartMin(entry: TimeEntry): number {
    const d = new Date(entry.startTime);
    return d.getHours() * 60 + d.getMinutes();
  }

  private snap(minutes: number): number {
    return Math.round(minutes / SNAP_MIN) * SNAP_MIN;
  }

  private snapDown(minutes: number): number {
    return Math.floor(minutes / SNAP_MIN) * SNAP_MIN;
  }

  /** Instant for a minute of the given day; 1440 (24:00) is midnight of the following day. */
  private instantAt(date: string, minutes: number): string {
    const day = toIsoDate(addDays(parseIsoDate(date), Math.floor(minutes / DAY_MIN)));
    return toInstant(day, this.minutesToTime(minutes % DAY_MIN));
  }

  /** HH:MM; 1440 renders as 24:00 (for labels). */
  private minutesToTime(minutes: number): string {
    const m = Math.min(Math.max(0, Math.round(minutes)), DAY_MIN);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  private emptyForm(): TimeEntryInput {
    return { projectId: '', taskId: null, description: '', startTime: '', endTime: '', billable: true, tagIds: [] };
  }
}
