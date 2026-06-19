import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TimeEntryApiService } from '../../core/api/time-entry-api.service';
import { TimeEntry } from '../../core/models';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { addDays, startOfWeek, toIsoDate } from '../../shared/utils/date-utils';

const HOUR_PX = 44;

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

@Component({
  selector: 'app-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DurationPipe],
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
          <div class="cal">
            <div class="hours">
              <div class="hd"></div>
              @for (h of hours; track h) { <div class="hour-label" [style.height.px]="hourPx">{{ h }}:00</div> }
            </div>
            @for (col of columns(); track col.date) {
              <div class="day">
                <div class="hd">{{ col.label }}</div>
                <div class="grid-bg" [style.height.px]="hourPx * 24">
                  @for (h of hours; track h) { <div class="hline" [style.top.px]="h * hourPx"></div> }
                  @for (b of col.blocks; track b.entry.id) {
                    <div class="block" [style.top.px]="b.top" [style.height.px]="b.height"
                         [title]="b.entry.description || b.entry.projectName">
                      <div class="b-proj">{{ b.entry.projectName }}</div>
                      <div class="b-dur mono">{{ b.entry.durationSeconds | duration: 'HH:MM' }}</div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .cal { display: flex; min-width: 760px; }
    .hours { width: 52px; flex-shrink: 0; }
    .day { flex: 1; border-left: 1px solid var(--border); }
    .hd { height: 36px; display: flex; align-items: center; justify-content: center;
          font-size: var(--fs-sm); font-weight: 600; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--surface); z-index: 2; }
    .hour-label { font-size: var(--fs-xs); color: var(--text-faint); text-align: right; padding-right: var(--sp-2); box-sizing: border-box; }
    .grid-bg { position: relative; }
    .hline { position: absolute; left: 0; right: 0; border-top: 1px solid var(--border); opacity: 0.5; }
    .block { position: absolute; left: 3px; right: 3px; background: var(--brand-soft); border-left: 3px solid var(--brand);
             border-radius: var(--radius-sm); padding: 2px 4px; overflow: hidden; font-size: var(--fs-xs); }
    .b-proj { font-weight: 600; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .b-dur { color: var(--text-muted); }
  `],
})
export class CalendarComponent {
  private readonly api = inject(TimeEntryApiService);

  protected readonly hourPx = HOUR_PX;
  protected readonly hours = Array.from({ length: 24 }, (_, i) => i);
  protected readonly loading = signal(true);
  protected weekStart = startOfWeek(new Date());
  private readonly entries = signal<TimeEntry[]>([]);

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
          const height = Math.max(16, (e.durationSeconds / 3600) * HOUR_PX);
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
}
