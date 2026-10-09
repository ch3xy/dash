import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ClientApiService } from '../../core/api/client-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { ReportApiService } from '../../core/api/report-api.service';
import { BudgetReportRow, Client, PROJECT_STATUS_LABELS, Project, ProjectStatus, SummaryReport } from '../../core/models';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { LucideArrowLeft, LucidePencil } from '@lucide/angular';
import { websiteHref } from '../../shared/utils/url-utils';
import { ClientFormDialogComponent } from './client-form-dialog.component';

@Component({
  selector: 'app-client-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe, DurationPipe, MoneyPipe, LucideArrowLeft, LucidePencil, ClientFormDialogComponent],
  styles: [`.row-link { cursor: pointer; }`],
  template: `
    <div class="page">
      @if (client(); as c) {
        <div class="page-header">
          <div>
            <a routerLink="/clients" class="muted back-link"><svg lucideArrowLeft></svg> Kunden</a>
            <h1 class="row gap-2">
              {{ c.name }}
              @if (c.archived) { <span class="badge muted">Archiviert</span> }
            </h1>
            <div class="muted">
              {{ c.email || 'Keine E-Mail' }}
              @if (c.website) { · <a [href]="websiteHref(c.website)" target="_blank" rel="noopener">{{ c.website }}</a> }
            </div>
          </div>
          <div class="row">
            <button class="btn" (click)="editing.set(true)"><svg lucidePencil></svg> Bearbeiten</button>
            @if (!c.archived) { <button class="btn" (click)="archive(c)">Archivieren</button> }
            <button class="btn" (click)="remove(c)">Löschen</button>
          </div>
        </div>

        @if (c.description) {
          <div class="card card-pad muted">{{ c.description }}</div>
        }

        @if (summary(); as s) {
          <div class="card card-pad mt-4">
            <div class="card-title">Gesamt</div>
            <div class="row" style="gap: var(--sp-6)">
              <div><div class="faint">Erfasst</div><strong class="mono">{{ s.totalDurationSeconds | duration: 'HH:MM' }}</strong></div>
              <div><div class="faint">Abrechenbar</div><strong class="mono">{{ s.billableDurationSeconds | duration: 'HH:MM' }}</strong></div>
              <div><div class="faint">Umsatz</div><strong class="mono">{{ s.revenueAmount | money: s.currencyCode }}</strong></div>
            </div>
          </div>
        }

        <div class="card mt-4" style="overflow-x: auto;">
          <div class="card-pad" style="border-bottom: 1px solid var(--border)"><div class="card-title" style="margin:0">Projekte</div></div>
          @if (projects().length === 0) {
            <div class="state">Diesem Kunden sind keine Projekte zugeordnet.</div>
          } @else {
            <table class="table">
              <thead>
                <tr><th>Projekt</th><th>Status</th><th class="num">Erfasst</th><th>Budget</th><th class="num">Verbrauch</th><th class="num">Umsatz</th></tr>
              </thead>
              <tbody>
                @for (p of projects(); track p.id) {
                  <tr class="row-link" (click)="openProject(p)">
                    <td>
                      <span class="row gap-2">
                        <span class="badge-dot" [style.background]="p.color || 'var(--brand)'"></span>
                        <a [routerLink]="['/projects', p.id]" (click)="$event.stopPropagation()"><strong>{{ p.name }}</strong></a>
                      </span>
                    </td>
                    <td><span class="badge" [class]="statusClass(p.status)">{{ statusLabels[p.status] }}</span></td>
                    <td class="num mono">{{ projectSeconds(p) | duration: 'HH:MM' }}</td>
                    @if (budgets()[p.id]; as b) {
                      <td style="min-width: 160px;">
                        <div class="mono">{{ b.usedMinutes * 60 | duration: 'HH:MM' }} / {{ p.hourBudgetMinutes! * 60 | duration: 'HH:MM' }}</div>
                        <div class="progress" [class]="budgetClass(b)"><span [style.width.%]="min(b.usedPercent ?? 0, 100)"></span></div>
                      </td>
                      <td class="num"><span class="badge" [class]="budgetClass(b)">{{ b.usedPercent ?? 0 | number: '1.0-0' }}%</span></td>
                    } @else {
                      <td class="mono">{{ p.hourBudgetMinutes ? (p.hourBudgetMinutes * 60 | duration: 'HH:MM') : '—' }}</td>
                      <td class="num faint">—</td>
                    }
                    <td class="num mono">{{ projectRevenue(p) | money: p.currencyCode }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      } @else {
        <div class="state"><div class="spinner"></div></div>
      }
    </div>

    @if (editing() && client(); as c) {
      <app-client-form-dialog [client]="c" (saved)="onSaved($event)" (closed)="editing.set(false)" />
    }
  `,
})
export class ClientDetailComponent {
  readonly id = input.required<string>();

  private readonly api = inject(ClientApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly reportApi = inject(ReportApiService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly statusLabels = PROJECT_STATUS_LABELS;
  protected readonly client = signal<Client | null>(null);
  protected readonly projects = signal<Project[]>([]);
  protected readonly summary = signal<SummaryReport | null>(null);
  /** projectId -> budget usage in the current budget period (only active projects with an hour budget). */
  protected readonly budgets = signal<Record<string, BudgetReportRow>>({});
  protected readonly editing = signal(false);
  protected readonly websiteHref = websiteHref;

  constructor() {
    queueMicrotask(() => this.loadAll());
  }

  private loadAll(): void {
    const id = this.id();
    this.api.get(id).subscribe((c) => this.client.set(c));
    // The project endpoint has no client filter; the list is small, so filter here.
    this.projectApi
      .getAll({ archived: true })
      .subscribe((all) => this.projects.set(all.filter((p) => p.clientId === id)));
    this.reportApi.summary({ clientId: id, groupBy: 'PROJECT' }).subscribe((s) => this.summary.set(s));
    this.reportApi.budget({}).subscribe((rows) => {
      this.budgets.set(Object.fromEntries(rows.map((r) => [r.projectId, r])));
    });
  }

  private group(p: Project) {
    return this.summary()?.groups.find((g) => g.key === p.id);
  }

  projectSeconds(p: Project): number {
    return this.group(p)?.durationSeconds ?? 0;
  }

  projectRevenue(p: Project): string {
    return this.group(p)?.revenueAmount ?? '0';
  }

  statusClass(s: ProjectStatus): string {
    return s === 'ACTIVE' ? 'ok' : 'muted';
  }

  budgetClass(b: BudgetReportRow): string {
    return b.status === 'EXCEEDED' ? 'danger' : b.status === 'WARNING' ? 'warn' : 'ok';
  }

  protected min(a: number, b: number): number {
    return Math.min(a, b);
  }

  openProject(p: Project): void {
    this.router.navigate(['/projects', p.id]);
  }

  onSaved(c: Client): void {
    this.client.set(c);
    this.editing.set(false);
  }

  archive(c: Client): void {
    this.api.archive(c.id).subscribe((updated) => {
      this.client.set(updated);
      this.toast.success('Archiviert');
    });
  }

  remove(c: Client): void {
    this.dialog
      .confirm({ title: 'Kunde löschen', message: `Kunde „${c.name}" löschen?`, confirmLabel: 'Löschen', danger: true })
      .then((ok) => {
        if (ok) {
          this.api.delete(c.id).subscribe(() => {
            this.toast.success('Gelöscht');
            this.router.navigate(['/clients']);
          });
        }
      });
  }
}
