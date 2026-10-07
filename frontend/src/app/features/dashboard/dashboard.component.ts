import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DashboardApiService } from '../../core/api/dashboard-api.service';
import { Dashboard } from '../../core/models';
import { persistQueryParams } from '../../core/view-state';
import { DateRangePickerComponent } from '../../shared/components/date-range-picker.component';
import { DonutGaugeComponent } from '../../shared/components/donut-gauge.component';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DateRange, RANGE_PRESETS, formatRange, matchPreset, parseIsoDate, weekRange } from '../../shared/utils/date-range';
import { addDays, timeOf, toIsoDate } from '../../shared/utils/date-utils';
import { LucideArrowRight } from '@lucide/angular';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe, DurationPipe, MoneyPipe, DonutGaugeComponent, DateRangePickerComponent, LucideArrowRight],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Dashboard</h1>
        <div class="page-controls">
          <app-date-range-picker [range]="range()" (rangeChange)="setRange($event)" align="end" />
        </div>
      </div>

      @if (loading() && !data()) {
        <div class="state"><div class="spinner"></div></div>
      } @else if (data(); as d) {
        <div class="grid grid-cards" [class.refreshing]="loading()">
          <div class="card card-pad">
            <div class="card-title">Heute</div>
            <div class="stat-value">{{ d.today.durationSeconds | duration: 'HH:MM' }}</div>
            <div class="muted">{{ d.today.revenueAmount | money }}</div>
          </div>
          <div class="card card-pad">
            <div class="card-title">{{ periodLabel() }}</div>
            <div class="stat-value">{{ d.period.durationSeconds | duration: 'HH:MM' }}</div>
            <div class="muted">{{ d.period.revenueAmount | money }}</div>
          </div>
          <div class="card card-pad">
            <div class="card-title">Ø pro Arbeitstag</div>
            <div class="stat-value">{{ avgPerWorkday(d) | duration: 'HH:MM' }}</div>
            <div class="muted">{{ workdays(d) }} Arbeitstage im Zeitraum</div>
          </div>
          <div class="card card-pad">
            <div class="card-title">Laufender Timer</div>
            @if (d.runningTimer; as t) {
              <div class="stat-value mono">{{ t.elapsedSeconds | duration }}</div>
              <div class="muted">{{ t.projectName }}</div>
            } @else {
              <div class="muted" style="padding-top: var(--sp-3)">Kein Timer aktiv</div>
              <a routerLink="/timer" class="btn btn-sm mt-4">Timer starten</a>
            }
          </div>
        </div>

        <div class="grid grid-2col mt-4">
          <div class="card card-pad">
            <div class="card-title">Budget-Warnungen</div>
            @if (d.budgetAlerts.length) {
              @for (a of d.budgetAlerts; track a.projectId) {
                <div class="row-between" style="padding: var(--sp-2) 0;">
                  <a [routerLink]="['/projects', a.projectId]">{{ a.projectName }}</a>
                  <span class="badge" [class.warn]="a.status === 'WARNING'" [class.danger]="a.status === 'EXCEEDED'">
                    {{ a.usedPercent | number: '1.0-0' }}%
                  </span>
                </div>
              }
            } @else {
              <div class="muted">Alle Projekte im Budget.</div>
            }
          </div>

          <div class="card card-pad" style="display: flex; flex-direction: column;">
            <div class="card-title">Billable-Quote</div>
            <div class="row gap-2" style="flex: 1; align-items: center; justify-content: space-around; flex-wrap: wrap;">
              <app-donut-gauge [ratio]="billableRatio(d.period)" label="abrechenbar" />
              <div>
                <div class="row-between gap-2" style="min-width: 150px;">
                  <span class="faint">Abrechenbar</span>
                  <span class="mono">{{ d.period.billableDurationSeconds | duration: 'HH:MM' }}</span>
                </div>
                <div class="row-between gap-2">
                  <span class="faint">Nicht abrechenbar</span>
                  <span class="mono">{{ d.period.durationSeconds - d.period.billableDurationSeconds | duration: 'HH:MM' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="card card-pad">
            <div class="card-title">Top-Kunden (Umsatz im Zeitraum)</div>
            @if (d.topClients.length) {
              @for (c of d.topClients; track c.clientId) {
                <div class="row-between" style="padding: var(--sp-2) 0;">
                  <span>{{ c.clientName }}</span>
                  <span class="mono">{{ c.revenueAmount | money }}</span>
                </div>
              }
            } @else {
              <div class="muted">Noch kein Umsatz.</div>
            }
          </div>

          <div class="card card-pad">
            <div class="card-title">Top-Projekte (Zeit im Zeitraum)</div>
            @if (d.topProjects.length) {
              @for (p of d.topProjects; track p.projectId) {
                <div style="padding: var(--sp-2) 0;">
                  <div class="row-between" style="margin-bottom: var(--sp-1)">
                    <span class="row gap-2">
                      <span class="badge-dot" [style.background]="p.color || 'var(--brand)'"></span>
                      <a [routerLink]="['/projects', p.projectId]">{{ p.projectName }}</a>
                    </span>
                    <span class="mono">{{ p.durationSeconds | duration: 'HH:MM' }}</span>
                  </div>
                  <div class="progress"><span [style.width.%]="barWidth(p.durationSeconds, d)"></span></div>
                </div>
              }
            } @else {
              <div class="muted">Noch keine Einträge.</div>
            }
          </div>
        </div>

        @if (d.recentEntries.length) {
          <div class="card mt-4">
            <div class="card-pad" style="border-bottom: 1px solid var(--border)">
              <div class="card-title" style="margin: 0">Letzte Einträge</div>
            </div>
            <table class="table">
              <tbody>
                @for (e of d.recentEntries; track e.id) {
                  <tr>
                    <td>
                      <span class="row gap-2">
                        <span class="badge-dot" [style.background]="e.projectColor || 'var(--brand)'"></span>
                        <span>{{ e.projectName }}</span>
                      </span>
                      @if (e.description) {
                        <div class="faint" style="font-size: var(--fs-sm); padding-left: 18px;">{{ e.description }}</div>
                      }
                    </td>
                    <td class="faint" style="white-space: nowrap; font-size: var(--fs-sm);">
                      {{ e.entryDate }} · {{ time(e.startTime) }}–{{ time(e.endTime) }}
                    </td>
                    <td class="num mono">{{ e.durationSeconds | duration: 'HH:MM' }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <div class="card-pad" style="border-top: 1px solid var(--border); text-align: right;">
              <a routerLink="/reports" class="btn btn-ghost btn-sm">Alle Einträge <svg lucideArrowRight></svg></a>
            </div>
          </div>
        }
      } @else {
        <div class="state">Keine Daten verfügbar.</div>
      }
    </div>
  `,
  styles: [`
    .page-header { gap: var(--sp-3); flex-wrap: wrap; }
    .refreshing { opacity: 0.6; transition: opacity 0.15s; }
    @media (max-width: 640px) {
      .page-header .page-controls { width: 100%; }
    }
  `],
})
export class DashboardComponent {
  private readonly api = inject(DashboardApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly data = signal<Dashboard | null>(null);
  protected readonly loading = signal(true);

  /** Selected period from the URL (?from=&to=), defaulting to the current week. */
  protected readonly range = toSignal(
    this.route.queryParamMap.pipe(map((p) => this.parseRange(p.get('from'), p.get('to')))),
    { initialValue: this.parseRange(null, null) },
  );

  protected readonly periodLabel = computed(
    () => matchPreset(this.range(), RANGE_PRESETS)?.label ?? formatRange(this.range()),
  );

  constructor() {
    persistQueryParams('dashboard');
    effect((onCleanup) => {
      const range = this.range();
      this.loading.set(true);
      const sub = this.api.get(range).subscribe({
        next: (d) => {
          this.data.set(d);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected setRange(range: DateRange): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: range, queryParamsHandling: 'merge' });
  }

  private parseRange(from: string | null, to: string | null): DateRange {
    return from && to && from <= to ? { from, to } : weekRange(toIsoDate(new Date()));
  }

  /** Mon–Fri days in the selected period. */
  protected workdays(d: Dashboard): number {
    let count = 0;
    for (let day = parseIsoDate(d.from); toIsoDate(day) <= d.to; day = addDays(day, 1)) {
      const dow = day.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }

  protected avgPerWorkday(d: Dashboard): number {
    return Math.round(d.period.durationSeconds / Math.max(this.workdays(d), 1));
  }

  protected barWidth(seconds: number, d: Dashboard): number {
    const max = Math.max(...d.topProjects.map((p) => p.durationSeconds), 1);
    return (seconds / max) * 100;
  }

  protected time(instant: string): string {
    return timeOf(instant);
  }

  protected billableRatio(stat: { durationSeconds: number; billableDurationSeconds: number }): number {
    return stat.durationSeconds > 0 ? stat.billableDurationSeconds / stat.durationSeconds : 0;
  }
}
