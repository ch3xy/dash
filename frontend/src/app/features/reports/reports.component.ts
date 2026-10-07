import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ClientApiService } from '../../core/api/client-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { ReportApiService } from '../../core/api/report-api.service';
import { TagApiService } from '../../core/api/tag-api.service';
import { TaskApiService } from '../../core/api/task-api.service';
import {
  AttendanceReport,
  BudgetReportRow,
  Client,
  GroupBy,
  HeatmapPoint,
  HeatmapReport,
  PageResponse,
  Project,
  ReportFilter,
  DailyBreakdown,
  DailyBreakdownDay,
  SummaryGroup,
  SummaryReport,
  Tag,
  Task,
  TimeEntry,
} from '../../core/models';
import { ReportDonutComponent, DonutSegment } from '../../shared/components/report-donut.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { persistQueryParams } from '../../core/view-state';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker.component';
import { DateRange } from '../../shared/utils/date-range';
import { addDays, timeOf, toIsoDate, startOfWeek } from '../../shared/utils/date-utils';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

const GROUP_OPTIONS: GroupBy[] = ['PROJECT', 'CLIENT', 'TASK', 'TAG', 'DAY', 'WEEK', 'MONTH'];

const CHART_PALETTE = [
  '#6366f1', '#f97316', '#22c55e', '#eab308', '#ec4899',
  '#14b8a6', '#8b5cf6', '#ef4444', '#3b82f6', '#f59e0b',
];

type DetailRow =
  | { kind: 'header'; label: string }
  | { kind: 'entry'; entry: TimeEntry }
  | { kind: 'subtotal'; totalSeconds: number; revenueAmount: string };

@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DecimalPipe, DurationPipe, MoneyPipe, DateRangePickerComponent, ReportDonutComponent, LucideChevronLeft, LucideChevronRight],
  template: `
    <div class="page">
      <!-- Top bar: view toggle + export + date range -->
      <div class="page-header">
        <div class="rpt-tabs">
          <button class="rpt-tab" [class.active]="view() === 'uebersicht'" (click)="view.set('uebersicht')">Übersicht</button>
          <button class="rpt-tab" [class.active]="view() === 'detailliert'" (click)="view.set('detailliert')">Detailliert</button>
        </div>
        <div class="page-controls">
          <div class="export-wrap">
            <button class="btn btn-sm" (click)="exportOpen.update(v => !v)" type="button">Export ▾</button>
            @if (exportOpen()) {
              <div class="export-menu">
                <a class="export-item" [href]="csvUrl()" (click)="exportOpen.set(false)">CSV herunterladen</a>
                <a class="export-item" [href]="xlsxUrl()" (click)="exportOpen.set(false)">XLSX herunterladen</a>
              </div>
            }
          </div>
          <app-date-range-picker [range]="range()" (rangeChange)="patch($event)" align="end" />
        </div>
      </div>

      <!-- Filter bar -->
      <div class="card card-pad filter-bar">
        <div class="field">
          <label>Kunde</label>
          <select class="select" [ngModel]="f().clientId" (ngModelChange)="patch({ clientId: $event })">
            <option [ngValue]="undefined">Alle</option>
            @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label>Projekt</label>
          <select class="select" [ngModel]="f().projectId" (ngModelChange)="patch({ projectId: $event, taskId: undefined })">
            <option [ngValue]="undefined">Alle</option>
            @for (p of projects(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label>Task</label>
          <select class="select" [ngModel]="f().taskId" (ngModelChange)="patch({ taskId: $event })"
                  [disabled]="!f().projectId" [title]="f().projectId ? '' : 'Zuerst Projekt wählen'">
            <option [ngValue]="undefined">Alle</option>
            @for (t of tasks(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label>Tag</label>
          <select class="select" [ngModel]="f().tagId" (ngModelChange)="patch({ tagId: $event })">
            <option [ngValue]="undefined">Alle</option>
            @for (t of tags(); track t.id) { <option [ngValue]="t.id">{{ t.name }}</option> }
          </select>
        </div>
        <div class="field">
          <label>Beschreibung</label>
          <input class="input" type="search" placeholder="Suchen…" [ngModel]="f().q ?? ''"
                 (change)="patch({ q: $any($event.target).value.trim() || undefined })" />
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

      </div>

      <!-- ─── Übersicht ─── -->
      @if (view() === 'uebersicht') {

      <!-- Summary cards -->
      @if (summary(); as s) {
        <div class="grid grid-cards mt-4">
          <div class="card card-pad"><div class="card-title">Gesamt</div><div class="stat-value">{{ s.totalDurationSeconds | duration: 'HH:MM' }}</div></div>
          <div class="card card-pad"><div class="card-title">Abrechenbar</div><div class="stat-value">{{ s.billableDurationSeconds | duration: 'HH:MM' }}</div></div>
          <div class="card card-pad"><div class="card-title">Billable-Quote</div><div class="stat-value">{{ s.billableRatio * 100 | number: '1.0-0' }}%</div></div>
          <div class="card card-pad"><div class="card-title">Umsatz</div><div class="stat-value mono">{{ s.revenueAmount | money: s.currencyCode }}</div></div>
        </div>

        <!-- Clockify-style overview: daily bars + project table + donut -->
        <div class="card mt-4 ov-card">
          <!-- Daily bar chart (stacked by project) -->
          @if (dailyBreakdown(); as db) {
            <div class="ov-bars-wrap card-pad" style="border-bottom: 1px solid var(--border)">
              <div class="ov-bars">
                @for (day of db.days; track day.date) {
                  <div class="ov-bar-col" [class.ov-bar-col-zero]="day.totalSeconds === 0">
                    @if (db.days.length <= 14) {
                      <div class="ov-bar-label-top">
                        @if (day.totalSeconds > 0) { {{ day.totalSeconds | duration: 'HH:MM' }} }
                        @else { <span class="faint">—</span> }
                      </div>
                    } @else {
                      <div class="ov-bar-label-top"></div>
                    }
                    <div class="ov-bar-track">
                      <!-- Stacked segments, bottom to top = projects ordered by seconds desc -->
                      @if (day.totalSeconds > 0) {
                        <div class="ov-bar-stack"
                             [style.height.%]="dayBarPct(day.totalSeconds, db)"
                             [title]="barTooltip(day)">
                          @for (seg of day.projects; track seg.projectId) {
                            <div class="ov-bar-segment"
                                 [style.flex]="seg.durationSeconds"
                                 [style.background]="segColor(seg)">
                            </div>
                          }
                        </div>
                      }
                    </div>
                    <div class="ov-bar-label-bottom">{{ dayLabel(day.date, db.days.length) }}</div>
                  </div>
                }
              </div>
            </div>
          }
          <!-- Bottom: project table + donut -->
          <div class="ov-bottom">
            <div class="ov-table">
              <table class="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{{ s.groupedBy === 'PROJECT' ? 'Projekt' : s.groupedBy }}</th>
                    <th class="num">Dauer</th>
                    <th class="num">Umsatz</th>
                  </tr>
                </thead>
                <tbody>
                  @for (g of s.groups; track g.key; let i = $index) {
                    <tr class="ov-group-row"
                        [class.clickable]="drillable(s)"
                        (click)="drillable(s) && drillDown(s, { label: g.label, value: g.durationSeconds, key: g.key })">
                      <td class="faint">{{ i + 1 }}</td>
                      <td>
                        <span class="ov-dot" [style.background]="groupColor(g, i)"></span>
                        <span>{{ g.label }}</span>
                        @if (groupClientName(g)) {
                          <span class="faint"> – {{ groupClientName(g) }}</span>
                        }
                      </td>
                      <td class="num mono">{{ g.durationSeconds | duration: 'HH:MM' }}</td>
                      <td class="num mono faint">{{ g.revenueAmount | money: s.currencyCode }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="faint" style="text-align:center">Keine Daten</td></tr>
                  }
                </tbody>
              </table>
            </div>
            <div class="ov-donut">
              <app-report-donut
                [segments]="donutSegments(s)"
                [centerLabel]="s.totalDurationSeconds | duration: 'HH:MM'"
                centerSub="Gesamt" />
              <div class="ov-legend">
                @for (seg of donutSegments(s); track seg.label) {
                  <div class="ov-legend-row">
                    <span class="ov-dot" [style.background]="seg.color"></span>
                    <span class="ov-legend-label">{{ seg.label }}</span>
                    <span class="ov-legend-val mono">{{ seg.display }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      }

      } <!-- end Übersicht -->

      <!-- ─── Detailliert ─── -->
      @if (view() === 'detailliert') {

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

      <!-- Attendance -->
      @if (attendance(); as a) {
        @if (a.days.length) {
          <div class="card mt-4" style="overflow-x: auto;">
            <div class="card-pad" style="border-bottom: 1px solid var(--border)">
              <div class="card-title" style="margin:0">Anwesenheit</div>
            </div>
            <table class="table">
              <thead><tr><th>Datum</th><th class="num">Erster Start</th><th class="num">Letztes Ende</th><th class="num">Erfasst</th><th class="num">Pausen</th></tr></thead>
              <tbody>
                @for (day of a.days; track day.date) {
                  <tr>
                    <td class="mono">{{ day.date }}</td>
                    <td class="num mono">{{ time(day.firstStart) }}</td>
                    <td class="num mono">{{ time(day.lastEnd) }}</td>
                    <td class="num mono">{{ day.totalSeconds | duration: 'HH:MM' }}</td>
                    <td class="num mono faint">{{ day.breakSeconds | duration: 'HH:MM' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

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
          <thead><tr><th>Datum</th><th>Projekt</th><th>Beschreibung</th><th>Tags</th><th>Zeit</th><th class="num">Dauer</th><th class="num">Betrag</th></tr></thead>
          <tbody>
            @for (r of detailedRows(); track $index) {
              @if (r.kind === 'header') {
                <tr class="group-hd-row">
                  <td colspan="7"><strong>{{ r.label }}</strong></td>
                </tr>
              } @else if (r.kind === 'subtotal') {
                <tr class="subtotal-row">
                  <td colspan="5" class="faint" style="font-size: var(--fs-sm); text-align: right;">Zwischensumme</td>
                  <td class="num mono">{{ r.totalSeconds | duration: 'HH:MM' }}</td>
                  <td class="num mono">{{ r.revenueAmount | money }}</td>
                </tr>
              } @else {
                <tr>
                  <td class="mono">{{ r.entry.entryDate }}</td>
                  <td>{{ r.entry.projectName }}@if (r.entry.taskName) { <span class="faint"> · {{ r.entry.taskName }}</span> }</td>
                  <td>{{ r.entry.description || '—' }}</td>
                  <td>
                    @for (tg of r.entry.tags; track tg.id) {
                      <span class="badge" [style.background]="tg.color || null">{{ tg.name }}</span>
                    } @empty { <span class="faint">—</span> }
                  </td>
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
              <button class="btn btn-sm" (click)="prevPage()" [disabled]="page() === 0" aria-label="Vorherige Seite"><svg lucideChevronLeft></svg></button>
              <span class="muted">Seite {{ page() + 1 }} / {{ d.totalPages }}</span>
              <button class="btn btn-sm" (click)="nextPage(d)" [disabled]="page() + 1 >= d.totalPages" aria-label="Nächste Seite"><svg lucideChevronRight></svg></button>
            </div>
          }
        }
      </div>

      } <!-- end Detailliert -->
    </div>
  `,
  styles: [`
    /* ── Top bar ── */
    .rpt-tabs { display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 2px; gap: 2px; }
    .rpt-tab { padding: 6px 18px; border-radius: calc(var(--radius) - 2px); border: none; background: none; cursor: pointer; font-size: var(--fs-sm); font-weight: 500; color: var(--text-muted); transition: background 150ms, color 150ms; white-space: nowrap; }
    .rpt-tab.active { background: var(--brand); color: #fff; }
    .rpt-tab:hover:not(.active) { background: var(--hover); color: var(--text); }
    .export-wrap { position: relative; }
    .export-menu { position: absolute; right: 0; top: calc(100% + 4px); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-lg); z-index: 20; min-width: 180px; overflow: hidden; }
    .export-item { display: block; padding: 10px 16px; font-size: var(--fs-sm); color: var(--text); white-space: nowrap; text-decoration: none; }
    .export-item:hover { background: var(--hover); }
    /* ── Filter bar ── */
    .filter-bar { display: flex; gap: var(--sp-3); flex-wrap: wrap; align-items: flex-end; position: sticky; top: 0; z-index: 5; }
    .filter-bar .field { margin: 0; min-width: 120px; }
    @media (max-width: 640px) {
      .filter-bar { position: static; gap: var(--sp-2); }
      .filter-bar .field { flex: 1 1 calc(50% - var(--sp-2)); min-width: 130px; }
      .filter-bar .field-range { flex-basis: 100%; }
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
    /* ── Clockify overview ── */
    .ov-card { overflow: visible; }
    .ov-bars-wrap { padding-bottom: var(--sp-4); }
    .ov-bars { display: flex; gap: 0; align-items: flex-end; height: 220px; overflow-x: auto; }
    .ov-bar-col { flex: 1; min-width: 28px; display: flex; flex-direction: column; align-items: center; height: 100%; }
    .ov-bar-label-top { font-size: var(--fs-xs); font-weight: 600; margin-bottom: 4px; text-align: center; height: 18px; line-height: 18px; white-space: nowrap; }
    .ov-bar-track { flex: 1; width: 64%; display: flex; align-items: flex-end; }
    .ov-bar-stack { width: 100%; display: flex; flex-direction: column-reverse; border-radius: var(--radius-sm) var(--radius-sm) 0 0; overflow: hidden; transition: height 0.3s; min-height: 2px; }
    .ov-bar-segment { width: 100%; min-height: 2px; transition: flex 0.3s; }
    .ov-bar-label-bottom { font-size: var(--fs-xs); color: var(--text-muted); margin-top: 6px; text-align: center; white-space: nowrap; }
    .ov-bottom { display: flex; gap: 0; align-items: flex-start; border-top: none; }
    .ov-table { flex: 1; min-width: 0; overflow-x: auto; }
    .ov-table .table td, .ov-table .table th { white-space: nowrap; }
    .ov-group-row.clickable { cursor: pointer; }
    .ov-group-row.clickable:hover td { background: color-mix(in srgb, var(--brand) 6%, transparent); }
    .ov-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; vertical-align: middle; }
    .ov-donut { flex-shrink: 0; width: 260px; padding: var(--sp-5); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); border-left: 1px solid var(--border); }
    .ov-legend { width: 100%; display: flex; flex-direction: column; gap: var(--sp-2); }
    .ov-legend-row { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--fs-sm); }
    .ov-legend-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ov-legend-val { color: var(--text-muted); }
    @media (max-width: 840px) {
      .ov-bottom { flex-direction: column; }
      .ov-donut { width: 100%; border-left: none; border-top: 1px solid var(--border); flex-direction: row; align-items: flex-start; flex-wrap: wrap; }
    }
  `],
})
export class ReportsComponent {
  private readonly reportApi = inject(ReportApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly tagApi = inject(TagApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly view = signal<'uebersicht' | 'detailliert'>('uebersicht');
  protected readonly exportOpen = signal(false);

  protected readonly groupOptions = GROUP_OPTIONS;
  protected readonly projects = signal<Project[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly tags = signal<Tag[]>([]);
  protected readonly summary = signal<SummaryReport | null>(null);
  protected readonly budget = signal<BudgetReportRow[]>([]);
  protected readonly detailed = signal<PageResponse<TimeEntry> | null>(null);
  protected readonly page = signal(0);

  protected readonly detailedRows = computed<DetailRow[]>(() => {
    const page = this.detailed();
    if (!page) return [];
    const groupBy = this.f().groupBy ?? 'PROJECT';

    const tagLabel = (e: TimeEntry): string | null =>
      e.tags.length ? e.tags.map((t) => t.name).sort().join(', ') : null;

    const getKey = (e: TimeEntry): string => {
      switch (groupBy) {
        case 'PROJECT': return e.projectId;
        case 'CLIENT':  return e.clientId ?? '__none__';
        case 'TASK':    return e.taskId ?? '__none__';
        case 'TAG':     return tagLabel(e) ?? '__none__';
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
        case 'TAG':     return tagLabel(e) ?? '(kein Tag)';
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
  protected readonly dailyBreakdown = signal<DailyBreakdown | null>(null);
  protected readonly attendance = signal<AttendanceReport | null>(null);
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

  protected readonly range = computed<DateRange>(() => {
    const { from, to } = this.f();
    const def = this.defaultFilter();
    return { from: from ?? def.from!, to: to ?? def.to! };
  });

  protected readonly billableStr = computed(() => {
    const b = this.f().billable;
    return b === undefined ? '' : String(b);
  });

  constructor() {
    persistQueryParams('reports');
    // Archived projects/clients stay filterable: their past time still belongs in reports.
    this.projectApi.getAll({ archived: true }).subscribe((p) => this.projects.set(p));
    this.clientApi.getAll(true).subscribe((c) => this.clients.set(c));
    this.tagApi.getAll().subscribe((t) => this.tags.set(t));
    this.loadHeatmap();
    // Task options depend on the selected project.
    effect(() => {
      const projectId = this.f().projectId;
      if (!projectId) {
        this.tasks.set([]);
        return;
      }
      this.taskApi.getForProject(projectId).subscribe((t) => this.tasks.set(t));
    });
    // React to filter changes.
    // untracked() prevents loadAll/loadDetailed from registering this.page()
    // as an effect dependency — otherwise nextPage() would re-trigger the effect
    // and reset page back to 0.
    effect(() => {
      const filter = this.f();
      this.page.set(0);
      untracked(() => this.loadAll(filter));
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
      taskId: p['taskId'] || undefined,
      tagId: p['tagId'] || undefined,
      q: p['q'] || undefined,
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
    this.reportApi.attendance(filter.from, filter.to).subscribe((a) => this.attendance.set(a));
    this.reportApi.dailyBreakdown(filter).subscribe((b) => this.dailyBreakdown.set(b));
    this.loadDetailed(filter);
  }

  private loadDetailed(filter: ReportFilter): void {
    this.reportApi
      .detailed({ ...filter, page: this.page(), size: 25 })
      .subscribe((d) => this.detailed.set(d));
  }

  drillable(s: SummaryReport): boolean {
    return ['PROJECT', 'CLIENT', 'TASK', 'TAG', 'DAY', 'WEEK', 'MONTH'].includes(s.groupedBy);
  }

  /** Click on a chart bar narrows the report filter to that group. */
  drillDown(s: SummaryReport, d: { label: string; value: number; key?: string }): void {
    if (!d.key) return;
    switch (s.groupedBy) {
      case 'PROJECT':
        this.patch({ projectId: d.key });
        break;
      case 'CLIENT':
        this.patch({ clientId: d.key });
        break;
      case 'TASK':
        // The task select only lists tasks of the selected project, so set both.
        this.taskApi.get(d.key).subscribe((t) => this.patch({ projectId: t.projectId, taskId: t.id }));
        break;
      case 'TAG':
        this.patch({ tagId: d.key });
        break;
      case 'DAY':
        this.patch({ from: d.key, to: d.key, groupBy: 'PROJECT' });
        break;
      case 'WEEK':
        this.patch({ from: d.key, to: toIsoDate(addDays(new Date(d.key + 'T12:00:00'), 6)), groupBy: 'DAY' });
        break;
      case 'MONTH': {
        const [y, m] = d.key.split('-').map(Number);
        this.patch({
          from: toIsoDate(new Date(y, m - 1, 1)),
          to: toIsoDate(new Date(y, m, 0)),
          groupBy: 'DAY',
        });
        break;
      }
    }
  }

  donutSegments(s: SummaryReport): DonutSegment[] {
    const total = s.totalDurationSeconds;
    if (total === 0) return [];
    return s.groups.map((g, i) => ({
      label: g.label,
      display: new DurationPipe().transform(g.durationSeconds, 'HH:MM'),
      color: this.groupColor(g, i),
      fraction: g.durationSeconds / total,
    }));
  }

  groupColor(g: SummaryGroup, index: number): string {
    if (this.f().groupBy === 'PROJECT') {
      const proj = this.projects().find((p) => p.id === g.key);
      if (proj?.color) return proj.color;
    }
    return CHART_PALETTE[index % CHART_PALETTE.length];
  }

  groupClientName(g: SummaryGroup): string | null {
    if (this.f().groupBy !== 'PROJECT') return null;
    const proj = this.projects().find((p) => p.id === g.key);
    if (!proj?.clientId) return null;
    return this.clients().find((c) => c.id === proj.clientId)?.name ?? null;
  }

  dayBarPct(totalSeconds: number, db: DailyBreakdown): number {
    const max = Math.max(...db.days.map((d) => d.totalSeconds), 1);
    return (totalSeconds / max) * 100;
  }

  segColor(seg: DailyBreakdownDay['projects'][number]): string {
    if (seg.projectColor) return seg.projectColor;
    // Fallback: use palette position based on project order in summary groups
    const idx = (this.summary()?.groups ?? []).findIndex((g) => g.key === seg.projectId);
    return CHART_PALETTE[Math.max(0, idx) % CHART_PALETTE.length];
  }

  barTooltip(day: DailyBreakdownDay): string {
    return day.projects.map((s) => `${s.projectName}: ${new DurationPipe().transform(s.durationSeconds, 'HH:MM')}`).join('\n');
  }

  dayLabel(period: string, totalDays = 7): string {
    if (!period || !period.includes('-')) return period;
    try {
      const d = new Date(period + 'T12:00:00');
      if (totalDays > 14) {
        // Only day number; mark Mondays with a dot prefix so weeks stay readable
        const day = d.getDate();
        const dow = (d.getDay() + 6) % 7; // 0=Mon
        return dow === 0 ? `·${day}` : String(day);
      }
      return d.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' });
    } catch {
      return period;
    }
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
