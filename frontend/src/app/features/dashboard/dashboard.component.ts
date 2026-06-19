import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardApiService } from '../../core/api/dashboard-api.service';
import { Dashboard } from '../../core/models';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe, DurationPipe, MoneyPipe],
  template: `
    <div class="page">
      <div class="page-header"><h1>Dashboard</h1></div>

      @if (loading()) {
        <div class="state"><div class="spinner"></div></div>
      } @else if (data(); as d) {
        <div class="grid grid-cards">
          <div class="card card-pad">
            <div class="card-title">Heute</div>
            <div class="stat-value">{{ d.today.durationSeconds | duration: 'HH:MM' }}</div>
            <div class="muted">{{ d.today.revenueAmount | money }}</div>
          </div>
          <div class="card card-pad">
            <div class="card-title">Diese Woche</div>
            <div class="stat-value">{{ d.thisWeek.durationSeconds | duration: 'HH:MM' }}</div>
            <div class="muted">{{ d.thisWeek.revenueAmount | money }}</div>
          </div>
          <div class="card card-pad">
            <div class="card-title">Dieser Monat</div>
            <div class="stat-value">{{ d.thisMonth.durationSeconds | duration: 'HH:MM' }}</div>
            <div class="muted">{{ d.thisMonth.revenueAmount | money }}</div>
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

        <div class="grid mt-4" style="grid-template-columns: 1fr 1fr;">
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

          <div class="card card-pad">
            <div class="card-title">Top-Kunden (Umsatz)</div>
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
        </div>

        <div class="card card-pad mt-4">
          <div class="card-title">Top-Projekte (Zeit)</div>
          @if (d.topProjects.length) {
            @for (p of d.topProjects; track p.projectId) {
              <div style="padding: var(--sp-2) 0;">
                <div class="row-between" style="margin-bottom: var(--sp-1)">
                  <a [routerLink]="['/projects', p.projectId]">{{ p.projectName }}</a>
                  <span class="mono">{{ p.durationSeconds | duration: 'HH:MM' }}</span>
                </div>
                <div class="progress"><span [style.width.%]="barWidth(p.durationSeconds, d)"></span></div>
              </div>
            }
          } @else {
            <div class="muted">Noch keine Einträge.</div>
          }
        </div>
      } @else {
        <div class="state">Keine Daten verfügbar.</div>
      }
    </div>
  `,
})
export class DashboardComponent {
  private readonly api = inject(DashboardApiService);
  protected readonly data = signal<Dashboard | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    this.api.get().subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected barWidth(seconds: number, d: Dashboard): number {
    const max = Math.max(...d.topProjects.map((p) => p.durationSeconds), 1);
    return (seconds / max) * 100;
  }
}
