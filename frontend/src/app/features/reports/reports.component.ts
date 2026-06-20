import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ClientApiService } from '../../core/api/client-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { ReportApiService } from '../../core/api/report-api.service';
import {
  BudgetReportRow,
  Client,
  GroupBy,
  Granularity,
  HeatmapPoint,
  HeatmapReport,
  PageResponse,
  Project,
  ReportFilter,
  SummaryReport,
  TimeEntry,
  TrendReport,
} from '../../core/models';
import { BarChartComponent, BarDatum } from '../../shared/components/bar-chart.component';
import { LineChartComponent, LinePoint } from '../../shared/components/line-chart.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { addDays, timeOf, toIsoDate, startOfWeek } from '../../shared/utils/date-utils';

const GROUP_OPTIONS: GroupBy[] = ['PROJECT', 'CLIENT', 'TASK', 'DAY', 'WEEK', 'MONTH'];

type DetailRow =
  | { kind: 'header'; label: string }
  | { kind: 'entry'; entry: TimeEntry }
  | { kind: 'subtotal'; totalSeconds: number; revenueAmount: string };

@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, DurationPipe, MoneyPipe, BarChartComponent, LineChartComponent],
  template: `
    <div class="page">
      <div class="page-header"><h1>Reports</h1></div>

      <!-- Filter bar -->
      <div class="card card-pad filter-bar">
        <div class="field"><label>Von</label><input class="input" type="date" [ngModel]="f().from" (ngModelChange)="patch({ from: $event })" /></div>
        <div class="field"><label>Bis</label><input class="input" type="date" [ngModel]="f().to" (ngModelChange)="patch({ to: $event })" /></div>
        <div class="field">
          <label>Kunde</label>
          <select class="select" [ngModel]="f().clientId" (ngModelChange)="patch({ clientId: $event })">
            <option [ngValue]="undefined">Alle</option>
            @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label>Projekt</label>
          <select class="select" [ngModel]="f().projectId" (ngModelChange)="patch({ projectId: $event })">
            <option [ngValue]="undefined">Alle</option>
            @for (p of projects(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label>Abrechenbar</label>
          <select class="select" [ngModel]="billableStr()" (ngModelChange)="patch({ billable: $event === '' ? undefined : $event === 'true' })">
            <option value="">Alle</option><option value="true">Ja</option><option value="false">Nein</option>
          </select>
        </div>
        <div class="field">
          <label>Gruppierung</label>
          <select class="select" [ngModel]="f().groupBy ?? 'PROJECT'" (ngModelChange)="patch({ groupBy: $event })">
            @for (g of groupOptions; track g) { <option [ngValue]="g">{{ g }}</option> }
          </select>
        </div>
        <label class="switch" style="align-self: flex-end; height: 38px;">
          <input type="checkbox" [ngModel]="f().rounded === true" (ngModelChange)="patch({ rounded: $event })" /> Gerundet
        </label>
        <div class="row" style="align-self: flex-end; margin-left: auto;">
          <a class="btn btn-sm" [href]="csvUrl()">CSV</a>
          <a class="btn btn-sm" [href]="xlsxUrl()">XLSX</a>
        </div>
      </div>

      <!-- Summary cards -->
      @if (summary(); as s) {
        <div class="grid grid-cards mt-4">
          <div class="card card-pad"><div class="card-title">Gesamt</div><div class="stat-value">{{ s.totalDurationSeconds | duration: 'HH:MM' }}</div></div>
          <div class="card card-pad"><div class="card-title">Abrechenbar</div><div class="stat-value">{{ s.billableDurationSeconds | duration: 'HH:MM' }}</div></div>
          <div class="card card-pad"><div class="card-title">Billable-Quote</div><div class="stat-value">{{ s.billableRatio * 100 | number: '1.0-0' }}%</div></div>
          <div class="card card-pad"><div class="card-title">Umsatz</div><div class="stat-value mono">{{ s.revenueAmount | money: s.currencyCode }}</div></div>
        </div>

        <div class="grid grid-2col mt-4">
          <div class="card card-pad">
            <div class="card-title">Nach {{ s.groupedBy }} — Zeit</div>
            <app-bar-chart [data]="groupBars(s)" />
          </div>
          <div class="card card-pad">
            <div class="card-title">Nach {{ s.groupedBy }} — Umsatz</div>
            <app-bar-chart [data]="revenueBars(s)" />
          </div>
        </div>
      }

      <!-- Trend -->
      <div class="card card-pad mt-4">
        <div class="row-between">
          <div class="card-title" style="margin: 0">Trend</div>
          <select class="select btn-sm" [ngModel]="granularity()" (ngModelChange)="granularity.set($event); loadTrend()" style="width: auto;">
            <option value="DAY">Täglich</option><option value="WEEK">Wöchentlich</option><option value="MONTH">Monatlich</option>
          </select>
        </div>
        @if (trend(); as t) { <app-line-chart [points]="trendPoints(t)" /> }
      </div>

      <!-- Heatmap -->
      <div class="card card-pad mt-4">
        <div class="row-between">
          <div class="card-title" style="margin: 0">Aktivitäts-Heatmap</div>
          <select class="select btn-sm" [ngModel]="heatmapYear()" (ngModelChange)="heatmapYear.set($event); loadHeatmap()" style="width: auto;">
            @for (y of heatmapYears; track y) { <option [ngValue]="y">{{ y }}</option> }
          </select>
        </div>
        @if (heatmap(); as h) {
          <div class="heatmap-wrap">
            <div class="heatmap-days">
              @for (d of weekDayLabels; track d) { <div>{{ d }}</div> }
            </div>
            <div class="heatmap-grid" style="overflow-x: auto;">
              @for (week of heatmapGrid(); track $index) {
                <div class="hm-col">
                  @for (cell of week; track $index) {
                    @if (cell) {
                      <div class="hm-cell"
                           [class.hm-0]="cell.intensity === 0"
                           [class.hm-1]="cell.intensity > 0 && cell.intensity <= 0.25"
                           [class.hm-2]="cell.intensity > 0.25 && cell.intensity <= 0.5"
                           [class.hm-3]="cell.intensity > 0.5 && cell.intensity <= 0.75"
                           [class.hm-4]="cell.intensity > 0.75"
                           [title]="cell.date + ': ' + (cell.durationSeconds | duration: 'HH:MM')">
                      </div>
                    } @else {
                      <div class="hm-cell hm-empty"></div>
                    }
                  }
                </div>
              }
            </div>
          </div>
          <div class="heatmap-legend">
            <span class="faint" style="font-size: var(--fs-xs)">weniger</span>
            <div class="hm-cell hm-0"></div>
            <div class="hm-cell hm-1"></div>
            <div class="hm-cell hm-2"></div>
            <div class="hm-cell hm-3"></div>
            <div class="hm-cell hm-4"></div>
            <span class="faint" style="font-size: var(--fs-xs)">mehr</span>
          </div>
        } @else {
          <div class="state"><div class="spinner"></div></div>
        }
      </div>

      <!-- Budget -->
      @if (budget().length) {
        <div class="card mt-4" style="overflow-x: auto;">
          <div class="card-pad" style="border-bottom: 1px solid var(--border)"><div class="card-title" style="margin:0">Projektbudgets</div></div>
          <table class="table">
            <thead><tr><th>Projekt</th><th>Kunde</th><th class="num">Genutzt</th><th>Auslastung</th><th>Status</th></tr></thead>
            <tbody>
              @for (b of budget(); track b.projectId) {
                <tr>
                  <td>{{ b.projectName }}</td>
                  <td class="faint">{{ b.clientName || '—' }}</td>
                  <td class="num mono">{{ b.usedMinutes * 60 | duration: 'HH:MM' }}</td>
                  <td style="width: 160px;">
                    <div class="progress" [class]="budgetCls(b)"><span [style.width.%]="min(b.usedPercent || 0, 100)"></span></div>
                  </td>
                  <td><span class="badge" [class]="budgetCls(b)">{{ b.usedPercent != null ? (b.usedPercent | number: '1.0-0') + '%' : '—' }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Detailed -->
      <div class="card mt-4" style="overflow-x: auto;">
        <div class="card-pad row-between">
          <div class="card-title" style="margin: 0">Detaillierte Einträge</div>
          @if (detailed(); as d) { <span class="muted">{{ d.totalElements }} Einträge</span> }
        </div>
        <table class="table">
          <thead><tr><th>Datum</th><th>Projekt</th><th>Beschreibung</th><th>Zeit</th><th class="num">Dauer</th><th class="num">Betrag</th></tr></thead>
          <tbody>
            @for (r of detailedRows(); track $index) {
              @if (r.kind === 'header') {
                <tr class="group-hd-row">
                  <td colspan="6"><strong>{{ r.label }}</strong></td>
                </tr>
              } @else if (r.kind === 'subtotal') {
                <tr class="subtotal-row">
                  <td colspan="4" class="faint" style="font-size: var(--fs-sm); text-align: right;">Zwischensumme</td>
                  <td class="num mono">{{ r.totalSeconds | duration: 'HH:MM' }}</td>
                  <td class="num mono">{{ r.revenueAmount | money }}</td>
                </tr>
              } @else {
                <tr>
                  <td class="mono">{{ r.entry.entryDate }}</td>
                  <td>{{ r.entry.projectName }}@if (r.entry.taskName) { <span class="faint"> · {{ r.entry.taskName }}</span> }</td>
                  <td>{{ r.entry.description || '—' }}</td>
                  <td class="mono faint">{{ time(r.entry.startTime) }}–{{ time(r.entry.endTime) }}</td>
                  <td class="num mono">{{ r.entry.durationSeconds | duration: 'HH:MM' }}</td>
                  <td class="num mono">{{ r.entry.amountSnapshot | money: r.entry.currencyCodeSnapshot || 'EUR' }}</td>
                </tr>
              }
            }
          </tbody>
        </table>
        @if (detailed(); as d) {
          @if (d.totalPages > 1) {
            <div class="card-pad row-between">
              <button class="btn btn-sm" (click)="prevPage()" [disabled]="page() === 0">←</button>
              <span class="muted">Seite {{ page() + 1 }} / {{ d.totalPages }}</span>
              <button class="btn btn-sm" (click)="nextPage(d)" [disabled]="page() + 1 >= d.totalPages">→</button>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .filter-bar { display: flex; gap: var(--sp-3); flex-wrap: wrap; align-items: flex-end; position: sticky; top: 0; z-index: 5; }
    .filter-bar .field { margin: 0; min-width: 120px; }
    @media (max-width: 640px) {
      .filter-bar { position: static; gap: var(--sp-2); }
      .filter-bar .field { flex: 1 1 calc(50% - var(--sp-2)); min-width: 130px; }
    }
    .group-hd-row td { background: color-mix(in srgb, var(--brand) 6%, var(--surface)); border-top: 2px solid var(--border); padding: var(--sp-2) var(--sp-3) !important; }
    .subtotal-row td { background: color-mix(in srgb, var(--brand) 3%, var(--surface)); font-weight: 600; border-top: 1px dashed var(--border); }
    .heatmap-wrap { display: flex; gap: 4px; margin-top: var(--sp-3); align-items: flex-start; }
    .heatmap-days { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: var(--text-faint); padding-top: 0; width: 24px; flex-shrink: 0; }
    .heatmap-days div { height: 12px; line-height: 12px; text-align: right; padding-right: 4px; }
    .heatmap-grid { display: flex; gap: 2px; }
    .hm-col { display: flex; flex-direction: column; gap: 2px; }
    .hm-cell { width: 12px; height: 12px; border-radius: 2px; }
    .hm-empty { background: transparent; }
    .hm-0 { background: var(--border); }
    .hm-1 { background: color-mix(in srgb, var(--brand) 30%, var(--border)); }
    .hm-2 { background: color-mix(in srgb, var(--brand) 55%, var(--border)); }
    .hm-3 { background: color-mix(in srgb, var(--brand) 80%, var(--border)); }
    .hm-4 { background: var(--brand); }
    .heatmap-legend { display: flex; align-items: center; gap: 3px; margin-top: var(--sp-2); justify-content: flex-end; }
  `],
})
export class ReportsComponent {
  private readonly reportApi = inject(ReportApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly groupOptions = GROUP_OPTIONS;
  protected readonly projects = signal<Project[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly summary = signal<SummaryReport | null>(null);
  protected readonly trend = signal<TrendReport | null>(null);
  protected readonly budget = signal<BudgetReportRow[]>([]);
  protected readonly detailed = signal<PageResponse<TimeEntry> | null>(null);
  protected readonly granularity = signal<Granularity>('DAY');
  protected readonly page = signal(0);

  protected readonly detailedRows = computed<DetailRow[]>(() => {
    const page = this.detailed();
    if (!page) return [];
    const groupBy = this.f().groupBy ?? 'PROJECT';

    const getKey = (e: TimeEntry): string => {
      switch (groupBy) {
        case 'PROJECT': return e.projectId;
        case 'CLIENT':  return e.clientId ?? '__none__';
        case 'TASK':    return e.taskId ?? '__none__';
        case 'DAY':     return e.entryDate;
        case 'WEEK':    return toIsoDate(startOfWeek(new Date(e.entryDate + 'T12:00:00')));
        case 'MONTH':   return e.entryDate.slice(0, 7);
      }
    };

    const getLabel = (e: TimeEntry): string => {
      switch (groupBy) {
        case 'PROJECT': return e.projectName;
        case 'CLIENT':  return e.clientName ?? '(kein Kunde)';
        case 'TASK':    return e.taskName ?? '(kein Task)';
        case 'DAY':     return e.entryDate;
        case 'WEEK':    return 'Woche ab ' + toIsoDate(startOfWeek(new Date(e.entryDate + 'T12:00:00')));
        case 'MONTH':   return e.entryDate.slice(0, 7);
      }
    };

    const rows: DetailRow[] = [];
    let currentKey: string | null = null;
    let subtotalSec = 0;
    let subtotalRev = 0;

    for (const e of page.content) {
      const key = getKey(e);
      if (key !== currentKey) {
        if (currentKey !== null) {
          rows.push({ kind: 'subtotal', totalSeconds: subtotalSec, revenueAmount: subtotalRev.toFixed(2) });
        }
        rows.push({ kind: 'header', label: getLabel(e) });
        currentKey = key;
        subtotalSec = 0;
        subtotalRev = 0;
      }
      subtotalSec += e.durationSeconds;
      subtotalRev += Number(e.amountSnapshot ?? 0);
      rows.push({ kind: 'entry', entry: e });
    }
    if (currentKey !== null) {
      rows.push({ kind: 'subtotal', totalSeconds: subtotalSec, revenueAmount: subtotalRev.toFixed(2) });
    }
    return rows;
  });
  protected readonly heatmap = signal<HeatmapReport | null>(null);
  protected readonly heatmapYear = signal(new Date().getFullYear());
  protected readonly heatmapYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  protected readonly weekDayLabels = ['Mo', '', 'Mi', '', 'Fr', '', 'So'];

  protected readonly heatmapGrid = computed<Array<Array<HeatmapPoint | null>>>(() => {
    const h = this.heatmap();
    if (!h) return [];
    const byDate = new Map(h.data.map((p) => [p.date, p]));
    const year = h.year;
    // Start from Monday of week containing Jan 1
    const jan1 = new Date(year, 0, 1);
    const startDate = startOfWeek(jan1);
    // End at Sunday of week containing Dec 31
    const dec31 = new Date(year, 11, 31);
    const lastDow = (dec31.getDay() + 6) % 7;
    const endDate = addDays(dec31, 6 - lastDow);
    const weeks: Array<Array<HeatmapPoint | null>> = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
      const week: Array<HeatmapPoint | null> = [];
      for (let d = 0; d < 7; d++) {
        const iso = toIsoDate(cur);
        week.push(cur.getFullYear() === year
          ? (byDate.get(iso) ?? { date: iso, durationSeconds: 0, intensity: 0 })
          : null);
        cur = addDays(cur, 1);
      }
      weeks.push(week);
    }
    return weeks;
  });

  /** Filter derived from URL query params. */
  protected readonly f = toSignal(
    this.route.queryParams.pipe(map((p) => this.parse(p))),
    { initialValue: this.defaultFilter() },
  );

  protected readonly billableStr = computed(() => {
    const b = this.f().billable;
    return b === undefined ? '' : String(b);
  });

  constructor() {
    this.projectApi.getAll({ status: 'ACTIVE' }).subscribe((p) => this.projects.set(p));
    this.clientApi.getAll().subscribe((c) => this.clients.set(c));
    this.loadHeatmap();
    // React to filter changes.
    effect(() => {
      const filter = this.f();
      this.page.set(0);
      this.loadAll(filter);
    });
  }

  loadHeatmap(): void {
    this.heatmap.set(null);
    this.reportApi.heatmap(this.heatmapYear()).subscribe((h) => this.heatmap.set(h));
  }

  private defaultFilter(): ReportFilter {
    const to = new Date();
    const from = addDays(to, -29);
    return { from: toIsoDate(from), to: toIsoDate(to), groupBy: 'PROJECT' };
  }

  private parse(p: Record<string, string>): ReportFilter {
    const def = this.defaultFilter();
    return {
      from: p['from'] ?? def.from,
      to: p['to'] ?? def.to,
      clientId: p['clientId'] || undefined,
      projectId: p['projectId'] || undefined,
      billable: p['billable'] === undefined ? undefined : p['billable'] === 'true',
      groupBy: (p['groupBy'] as GroupBy) ?? 'PROJECT',
      rounded: p['rounded'] === 'true' ? true : undefined,
    };
  }

  patch(change: Partial<ReportFilter>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.f(), ...change },
      queryParamsHandling: 'merge',
    });
  }

  private loadAll(filter: ReportFilter): void {
    this.reportApi.summary(filter).subscribe((s) => this.summary.set(s));
    this.reportApi.budget(filter).subscribe((b) => this.budget.set(b));
    this.loadTrend();
    this.loadDetailed(filter);
  }

  loadTrend(): void {
    this.reportApi
      .trends({ ...this.f(), granularity: this.granularity() })
      .subscribe((t) => this.trend.set(t));
  }

  private loadDetailed(filter: ReportFilter): void {
    this.reportApi
      .detailed({ ...filter, page: this.page(), size: 25 })
      .subscribe((d) => this.detailed.set(d));
  }

  groupBars(s: SummaryReport): BarDatum[] {
    return s.groups.map((g) => ({
      label: g.label,
      value: g.durationSeconds,
      display: new DurationPipe().transform(g.durationSeconds, 'HH:MM'),
    }));
  }

  revenueBars(s: SummaryReport): BarDatum[] {
    return s.groups.map((g) => ({
      label: g.label,
      value: Number(g.revenueAmount),
      display: new MoneyPipe().transform(g.revenueAmount, s.currencyCode),
    }));
  }

  trendPoints(t: TrendReport): LinePoint[] {
    return t.data.map((d) => ({ label: d.period, value: d.durationSeconds }));
  }

  time(instant: string): string {
    return timeOf(instant);
  }

  budgetCls(b: BudgetReportRow): string {
    const pct = b.usedPercent ?? 0;
    return pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  csvUrl(): string {
    return this.reportApi.exportUrl('csv', this.f());
  }

  xlsxUrl(): string {
    return this.reportApi.exportUrl('xlsx', this.f());
  }

  prevPage(): void {
    this.page.update((p) => Math.max(0, p - 1));
    this.loadDetailed(this.f());
  }

  nextPage(d: PageResponse<TimeEntry>): void {
    if (this.page() + 1 < d.totalPages) {
      this.page.update((p) => p + 1);
      this.loadDetailed(this.f());
    }
  }
}
