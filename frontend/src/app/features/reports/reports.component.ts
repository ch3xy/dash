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
import { addDays, timeOf, toIsoDate } from '../../shared/utils/date-utils';

const GROUP_OPTIONS: GroupBy[] = ['PROJECT', 'CLIENT', 'TASK', 'DAY', 'WEEK', 'MONTH'];

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

        <div class="grid mt-4" style="grid-template-columns: 1fr 1fr;">
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

      <!-- Budget -->
      @if (budget().length) {
        <div class="card card-pad mt-4">
          <div class="card-title">Projektbudgets</div>
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
      <div class="card mt-4">
        <div class="card-pad row-between">
          <div class="card-title" style="margin: 0">Detaillierte Einträge</div>
          @if (detailed(); as d) { <span class="muted">{{ d.totalElements }} Einträge</span> }
        </div>
        <table class="table">
          <thead><tr><th>Datum</th><th>Projekt</th><th>Beschreibung</th><th>Zeit</th><th class="num">Dauer</th><th class="num">Betrag</th></tr></thead>
          <tbody>
            @for (e of detailed()?.content ?? []; track e.id) {
              <tr>
                <td class="mono">{{ e.entryDate }}</td>
                <td>{{ e.projectName }}@if (e.taskName) { <span class="faint"> · {{ e.taskName }}</span> }</td>
                <td>{{ e.description || '—' }}</td>
                <td class="mono faint">{{ time(e.startTime) }}–{{ time(e.endTime) }}</td>
                <td class="num mono">{{ e.durationSeconds | duration: 'HH:MM' }}</td>
                <td class="num mono">{{ e.amountSnapshot | money: e.currencyCodeSnapshot || 'EUR' }}</td>
              </tr>
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
    // React to filter changes.
    effect(() => {
      const filter = this.f();
      this.page.set(0);
      this.loadAll(filter);
    });
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
