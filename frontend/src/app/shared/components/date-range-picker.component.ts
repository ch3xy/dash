import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { addDays, startOfMonth, toIsoDate } from '../utils/date-utils';
import {
  DateRange,
  RangeMode,
  RangePreset,
  formatRange,
  isoWeek,
  matchPreset,
  monthGrid,
  parseIsoDate,
  presetsFor,
  shiftRange,
  weekRange,
} from '../utils/date-range';
import { LucideCalendar, LucideChevronDown, LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

interface DayCell {
  iso: string;
  day: number;
  label: string;
  inMonth: boolean;
  today: boolean;
  start: boolean;
  end: boolean;
  inRange: boolean;
}

const MONTH_LABEL = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' });
const DAY_LABEL = new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const WEEKDAY_HEADERS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Date range picker with quick presets, a month calendar and prev/next stepping.
 *
 * - `mode="range"`: free range (two clicks in the calendar) plus day…year presets.
 * - `mode="week"`: always a Mon–Sun week; a calendar click selects the whole week.
 *
 * Two-way bound via `[(range)]`. Keyboard: arrows/Home/End/PageUp/PageDown move
 * within the calendar, Enter/Space selects, Escape closes and returns focus.
 */
@Component({
  selector: 'app-date-range-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideCalendar, LucideChevronDown, LucideChevronLeft, LucideChevronRight],
  template: `
    <div class="drp" [class.drp-end]="align() === 'end'" [class.drp-md]="size() === 'md'">
      <button type="button" class="btn btn-sm drp-step" (click)="step(-1)" [attr.aria-label]="'Vorheriger Zeitraum'">
        <svg lucideChevronLeft></svg>
      </button>
      <button
        #trigger
        type="button"
        class="btn btn-sm drp-trigger"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel() + ': ' + primaryLabel() + (secondaryLabel() ? ', ' + secondaryLabel() : '')"
        (click)="toggle()">
        <svg lucideCalendar class="drp-icon"></svg>
        <span class="drp-primary">{{ primaryLabel() }}</span>
        @if (secondaryLabel()) { <span class="drp-secondary mono">{{ secondaryLabel() }}</span> }
        <svg lucideChevronDown class="drp-caret"></svg>
      </button>
      <button type="button" class="btn btn-sm drp-step" (click)="step(1)" [attr.aria-label]="'Nächster Zeitraum'">
        <svg lucideChevronRight></svg>
      </button>

      @if (open()) {
        <div class="drp-backdrop" (click)="close(true)"></div>
        <div class="drp-panel" role="dialog" [class.drp-above]="placement() === 'above'"
             [style.max-height.px]="maxHeight()" [attr.aria-label]="ariaLabel() + ' wählen'" (keydown.escape)="close(true)">
          <div class="drp-presets" role="group" aria-label="Schnellauswahl">
            @for (p of presets(); track p.id) {
              <button type="button" class="drp-preset" [class.active]="activePreset()?.id === p.id"
                      [attr.aria-pressed]="activePreset()?.id === p.id" (click)="applyPreset(p)">
                {{ p.label }}
              </button>
            }
          </div>

          <div class="drp-cal">
            <div class="drp-cal-head">
              <button type="button" class="btn btn-ghost btn-sm drp-month-nav" (click)="moveMonth(-1)" aria-label="Vorheriger Monat">
                <svg lucideChevronLeft></svg>
              </button>
              <span class="drp-month" aria-live="polite">{{ monthLabel() }}</span>
              <button type="button" class="btn btn-ghost btn-sm drp-month-nav" (click)="moveMonth(1)" aria-label="Nächster Monat">
                <svg lucideChevronRight></svg>
              </button>
            </div>

            <div class="drp-grid" role="grid" [attr.aria-label]="monthLabel()" (keydown)="onGridKey($event)"
                 (mouseleave)="hover.set(null)" [class.week-mode]="mode() === 'week'">
              <div class="drp-row drp-weekdays" role="row">
                <span class="drp-kw" role="columnheader" aria-label="Kalenderwoche">KW</span>
                @for (w of weekdays; track w) { <span role="columnheader">{{ w }}</span> }
              </div>
              @for (week of weeks(); track week[0].iso) {
                <div class="drp-row" role="row">
                  <span class="drp-kw" role="rowheader">{{ kw(week[0].iso) }}</span>
                  @for (d of week; track d.iso) {
                    <button
                      type="button"
                      role="gridcell"
                      class="drp-day"
                      [class.outside]="!d.inMonth"
                      [class.today]="d.today"
                      [class.in-range]="d.inRange"
                      [class.start]="d.start"
                      [class.end]="d.end"
                      [attr.data-iso]="d.iso"
                      [attr.aria-label]="d.label"
                      [attr.aria-selected]="d.inRange"
                      [attr.aria-current]="d.today ? 'date' : null"
                      [tabIndex]="d.iso === focused() ? 0 : -1"
                      (mouseenter)="hover.set(d.iso)"
                      (focus)="focused.set(d.iso)"
                      (click)="pick(d.iso)">
                      {{ d.day }}
                    </button>
                  }
                </div>
              }
            </div>

            <div class="drp-hint faint">
              @if (anchor()) { Enddatum wählen } @else if (mode() === 'week') { Tag anklicken, um die Woche zu wählen }
              @else { Start- und Enddatum anklicken }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .drp { position: relative; display: inline-flex; align-items: center; gap: var(--sp-1); }
    .drp-step { width: 30px; padding: 0; }
    .drp-trigger { min-width: 210px; justify-content: flex-start; gap: var(--sp-2); }
    .drp-md .drp-trigger, .drp-md .drp-step { height: 38px; }
    .drp-md .drp-step { width: 38px; }
    .drp-trigger[aria-expanded='true'] { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-soft); }
    .drp-icon { color: var(--text-muted); }
    .drp-primary { font-weight: 600; }
    .drp-secondary { color: var(--text-muted); font-size: var(--fs-xs); }
    .drp-caret { margin-left: auto; color: var(--text-muted); width: 14px; height: 14px; }

    .drp-backdrop { display: none; }
    .drp-panel {
      position: absolute; top: calc(100% + var(--sp-2)); left: 0; z-index: 50;
      display: flex; background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); box-shadow: var(--shadow-lg); overflow: hidden;
    }
    .drp-end .drp-panel { left: auto; right: 0; }
    .drp-panel { overflow-y: auto; overscroll-behavior: contain; }
    .drp-panel.drp-above { top: auto; bottom: calc(100% + var(--sp-2)); }

    .drp-presets {
      display: flex; flex-direction: column; gap: 2px; padding: var(--sp-2);
      border-right: 1px solid var(--border); background: var(--surface-2); min-width: 160px;
    }
    .drp-preset {
      text-align: left; padding: var(--sp-2) var(--sp-3); border: none; border-radius: var(--radius-sm);
      background: none; color: var(--text); font: inherit; font-size: var(--fs-sm); cursor: pointer; white-space: nowrap;
    }
    .drp-preset:hover { background: var(--hover); }
    .drp-preset.active { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
    .drp-preset:focus-visible, .drp-day:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }

    .drp-cal { padding: var(--sp-3) var(--sp-4) var(--sp-4); }
    .drp-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-2); }
    .drp-month-nav { width: 30px; padding: 0; }
    .drp-month { font-weight: 600; font-size: var(--fs-md); }

    .drp-grid { display: flex; flex-direction: column; gap: 2px; }
    .drp-row { display: grid; grid-template-columns: 28px repeat(7, 36px); gap: 2px 0; align-items: center; }
    .drp-weekdays span { font-size: var(--fs-xs); color: var(--text-muted); text-align: center; font-weight: 600; padding-bottom: var(--sp-1); }
    .drp-kw { font-size: var(--fs-xs); color: var(--text-faint); text-align: center; font-variant-numeric: tabular-nums; }
    .drp-day {
      height: 34px; border: none; background: none; color: var(--text); font: inherit; font-size: var(--fs-sm);
      font-variant-numeric: tabular-nums; cursor: pointer; border-radius: var(--radius-sm); position: relative;
    }
    .drp-day:hover { background: var(--hover); }
    .drp-day.outside { color: var(--text-faint); }
    .drp-day.today { font-weight: 700; color: var(--brand); }
    .drp-day.today::after {
      content: ''; position: absolute; bottom: 4px; left: 50%; width: 4px; height: 4px;
      margin-left: -2px; border-radius: 50%; background: currentColor;
    }
    .drp-day.in-range { background: var(--brand-soft); border-radius: 0; }
    .drp-day.start { border-top-left-radius: var(--radius-sm); border-bottom-left-radius: var(--radius-sm); }
    .drp-day.end { border-top-right-radius: var(--radius-sm); border-bottom-right-radius: var(--radius-sm); }
    .drp-day.start, .drp-day.end { background: var(--brand); color: #fff; }
    .drp-hint { font-size: var(--fs-xs); margin-top: var(--sp-3); text-align: center; }

    @media (max-width: 640px) {
      .drp { width: 100%; }
      .drp-trigger { flex: 1; min-width: 0; }
      .drp-secondary { display: none; }
      .drp-step, .drp-md .drp-step { width: 44px; height: 44px; }
      .drp-trigger, .drp-md .drp-trigger { height: 44px; }
      .drp-backdrop { display: block; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); z-index: 99; }
      .drp-panel {
        position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 100;
        flex-direction: column; max-height: 92dvh !important; overflow-y: auto;
        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
        padding-bottom: env(safe-area-inset-bottom);
      }
      .drp-end .drp-panel { right: 0; }
      .drp-presets { flex-direction: row; flex-wrap: wrap; border-right: none; border-bottom: 1px solid var(--border); min-width: 0; }
      .drp-preset { border: 1px solid var(--border); background: var(--surface); padding: var(--sp-2) var(--sp-3); min-height: 36px; }
      .drp-cal { display: flex; flex-direction: column; align-items: center; }
      .drp-row { grid-template-columns: 28px repeat(7, minmax(40px, 1fr)); width: 100%; }
      .drp-day { height: 44px; font-size: var(--fs-md); }
    }
  `],
})
export class DateRangePickerComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  /** Selected inclusive range (two-way bindable). */
  readonly range = model.required<DateRange>();
  readonly mode = input<RangeMode>('range');
  /** Which edge of the trigger the panel aligns to on desktop. */
  readonly align = input<'start' | 'end'>('start');
  readonly ariaLabel = input('Zeitraum');
  /** `md` matches form controls (38px), e.g. inside filter bars; `sm` fits page headers. */
  readonly size = input<'sm' | 'md'>('sm');

  protected readonly weekdays = WEEKDAY_HEADERS;
  protected readonly open = signal(false);
  protected readonly viewMonth = signal(startOfMonth(new Date()));
  protected readonly focused = signal(toIsoDate(new Date()));
  /** First click of a range selection, waiting for the second. */
  protected readonly anchor = signal<string | null>(null);
  protected readonly hover = signal<string | null>(null);
  /** Desktop placement relative to the trigger, chosen on open to stay inside the viewport. */
  protected readonly placement = signal<'below' | 'above'>('below');
  protected readonly maxHeight = signal<number | null>(null);

  protected readonly presets = computed(() => presetsFor(this.mode()));
  protected readonly activePreset = computed(() => matchPreset(this.range(), this.presets()));

  protected readonly primaryLabel = computed(() => {
    const preset = this.activePreset();
    if (preset) {
      return preset.label;
    }
    return this.mode() === 'week' ? `KW ${this.kw(this.range().from)}` : formatRange(this.range());
  });

  protected readonly secondaryLabel = computed(() => {
    const r = this.range();
    if (this.mode() === 'week') {
      return this.activePreset() ? `KW ${this.kw(r.from)} · ${formatRange(r)}` : formatRange(r);
    }
    return this.activePreset() ? formatRange(r) : '';
  });

  protected readonly monthLabel = computed(() => MONTH_LABEL.format(this.viewMonth()));

  /** Range to highlight: live preview while selecting, otherwise the current value. */
  private readonly highlight = computed<DateRange>(() => {
    const anchor = this.anchor();
    const hover = this.hover();
    if (anchor) {
      const other = hover ?? anchor;
      return anchor <= other ? { from: anchor, to: other } : { from: other, to: anchor };
    }
    if (this.mode() === 'week' && hover) {
      return weekRange(hover);
    }
    return this.range();
  });

  protected readonly weeks = computed<DayCell[][]>(() => {
    const month = this.viewMonth().getMonth();
    const todayIso = toIsoDate(new Date());
    const { from, to } = this.highlight();
    const cells = monthGrid(this.viewMonth()).map<DayCell>((d) => {
      const iso = toIsoDate(d);
      return {
        iso,
        day: d.getDate(),
        label: DAY_LABEL.format(d),
        inMonth: d.getMonth() === month,
        today: iso === todayIso,
        start: iso === from,
        end: iso === to,
        inRange: iso >= from && iso <= to,
      };
    });
    return Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  });

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  protected kw(iso: string): number {
    return isoWeek(parseIsoDate(iso));
  }

  protected toggle(): void {
    if (this.open()) {
      this.close(false);
      return;
    }
    const start = this.range().from;
    this.viewMonth.set(startOfMonth(parseIsoDate(start)));
    this.focused.set(start);
    this.anchor.set(null);
    this.hover.set(null);
    this.place();
    this.open.set(true);
    this.focusDay(start);
  }

  protected close(returnFocus: boolean): void {
    this.open.set(false);
    this.anchor.set(null);
    this.hover.set(null);
    if (returnFocus) {
      this.trigger().nativeElement.focus();
    }
  }

  protected step(direction: 1 | -1): void {
    this.range.set(shiftRange(this.range(), direction));
  }

  protected applyPreset(preset: RangePreset): void {
    this.range.set(preset.range(new Date()));
    this.close(true);
  }

  protected moveMonth(delta: number): void {
    const m = this.viewMonth();
    this.viewMonth.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  protected pick(iso: string): void {
    if (this.mode() === 'week') {
      this.range.set(weekRange(iso));
      this.close(true);
      return;
    }
    const anchor = this.anchor();
    if (!anchor) {
      this.anchor.set(iso);
      this.hover.set(iso);
      return;
    }
    this.range.set(anchor <= iso ? { from: anchor, to: iso } : { from: iso, to: anchor });
    this.close(true);
  }

  protected onGridKey(event: KeyboardEvent): void {
    const current = parseIsoDate(this.focused());
    let next: Date | null = null;
    switch (event.key) {
      case 'ArrowLeft': next = addDays(current, -1); break;
      case 'ArrowRight': next = addDays(current, 1); break;
      case 'ArrowUp': next = addDays(current, -7); break;
      case 'ArrowDown': next = addDays(current, 7); break;
      case 'Home': next = addDays(current, -((current.getDay() + 6) % 7)); break;
      case 'End': next = addDays(current, 6 - ((current.getDay() + 6) % 7)); break;
      case 'PageUp':
      case 'PageDown': {
        const dir = event.key === 'PageUp' ? -1 : 1;
        const months = event.shiftKey ? 12 * dir : dir;
        const target = new Date(current.getFullYear(), current.getMonth() + months, 1);
        const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
        next = new Date(target.getFullYear(), target.getMonth(), Math.min(current.getDate(), lastDay));
        break;
      }
    }
    if (!next) {
      return;
    }
    event.preventDefault();
    const iso = toIsoDate(next);
    if (next.getMonth() !== this.viewMonth().getMonth() || next.getFullYear() !== this.viewMonth().getFullYear()) {
      this.viewMonth.set(startOfMonth(next));
    }
    this.focused.set(iso);
    if (this.anchor() || this.mode() === 'week') {
      this.hover.set(iso);
    }
    this.focusDay(iso);
  }

  /** Opens below the trigger unless there is clearly more room above; caps height to the viewport. */
  private place(): void {
    const rect = this.trigger().nativeElement.getBoundingClientRect();
    const margin = 16;
    const below = window.innerHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const needed = this.mode() === 'week' ? 340 : 440;
    const placeAbove = below < needed && above > below;
    this.placement.set(placeAbove ? 'above' : 'below');
    this.maxHeight.set(Math.max(placeAbove ? above : below, 200));
  }

  /** Focuses a day button once it is rendered (after month changes or opening). */
  private focusDay(iso: string): void {
    setTimeout(() => {
      this.host.nativeElement.querySelector<HTMLButtonElement>(`[data-iso="${iso}"]`)?.focus();
    });
  }
}
