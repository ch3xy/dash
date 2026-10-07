import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideLock, LucideLockOpen } from '@lucide/angular';
import { ClosingApiService, MonthClosing } from '../../core/api/closing-api.service';
import { DialogService } from '../../core/dialog.service';
import { MonthLockStateService, monthLabel } from '../../core/month-lock-state.service';
import { ToastService } from '../../core/toast.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

/**
 * Monatsabschluss: close past months so their time entries become read-only,
 * and release them again. Releasing requires typing a confirmation phrase.
 */
@Component({
  selector: 'app-closing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DatePipe, DurationPipe, MoneyPipe, LucideLock, LucideLockOpen],
  styles: [`
    :host .page { max-width: 1080px; margin: 0 auto; }
    .unlock-panel { background: var(--warn-bg); border-radius: var(--radius, 8px); padding: 12px 16px; }
    .note { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    td.actions { text-align: right; white-space: nowrap; }
  `],
  template: `
    <div class="page">
      <div class="page-header"><h1>Monatsabschluss</h1></div>

      <p class="muted">
        Abgeschlossene Monate sind schreibgeschützt: Zeiteinträge können weder angelegt, geändert noch gelöscht werden,
        bis der Monat wieder freigegeben wird. Nur vollständig vergangene Monate lassen sich abschließen.
      </p>

      @if (unlocking(); as m) {
        <div class="card card-pad mt-4">
          <div class="unlock-panel">
            <strong>{{ label(m.month) }}</strong> wird freigegeben – die {{ m.entryCount }} Einträge
            ({{ m.totalSeconds | duration: 'HH:MM' }}) sind danach wieder bearbeitbar.
          </div>
          <div class="field mt-4">
            <label>Zur Bestätigung <strong class="mono">{{ unlockPhrase() }}</strong> eingeben</label>
            <input class="input mono" autocomplete="off" spellcheck="false"
                   [ngModel]="unlockInput()" (ngModelChange)="unlockInput.set($event)"
                   (keydown.enter)="unlockMatches() && unlock()" (keydown.escape)="cancelUnlock()" />
          </div>
          <div class="row gap-2">
            <button class="btn btn-primary" (click)="unlock()" [disabled]="!unlockMatches() || busy()">
              <svg lucideLockOpen></svg> Monat freigeben
            </button>
            <button class="btn btn-ghost" (click)="cancelUnlock()">Abbrechen</button>
          </div>
        </div>
      }

      <div class="card mt-4">
        @if (loading()) {
          <div class="state"><div class="spinner"></div></div>
        } @else if (error()) {
          <div class="state">
            <p class="muted">Monate konnten nicht geladen werden.</p>
            <button class="btn" (click)="load()">Erneut versuchen</button>
          </div>
        } @else if (months().length === 0) {
          <div class="state"><p class="muted">Noch keine Monate mit Zeiteinträgen.</p></div>
        } @else {
          <table class="table">
            <thead>
              <tr>
                <th>Monat</th>
                <th class="num">Einträge</th>
                <th class="num">Dauer</th>
                <th class="num">Abrechenbar</th>
                <th class="num">Umsatz</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (m of months(); track m.month) {
                <tr>
                  <td>
                    <a [routerLink]="['/reports']" [queryParams]="reportParams(m.month)" title="Im Report öffnen">
                      {{ label(m.month) }}
                    </a>
                  </td>
                  <td class="num">{{ m.entryCount }}</td>
                  <td class="num mono">{{ m.totalSeconds | duration: 'HH:MM' }}</td>
                  <td class="num mono">{{ m.billableSeconds | duration: 'HH:MM' }}</td>
                  <td class="num mono">{{ m.revenue | money: m.currency }}</td>
                  <td>
                    @if (m.locked) {
                      <span class="badge ok" [title]="m.note ?? ''"><svg lucideLock [size]="12"></svg> Abgeschlossen</span>
                      <div class="faint note" [title]="m.note ?? ''">
                        {{ m.lockedAt | date: 'dd.MM.yyyy HH:mm' }}@if (m.note) { · {{ m.note }} }
                      </div>
                    } @else if (m.lockable) {
                      <span class="badge warn">Offen</span>
                    } @else {
                      <span class="badge muted">Laufend</span>
                    }
                  </td>
                  <td class="actions">
                    @if (m.locked) {
                      <button class="btn btn-ghost btn-sm" (click)="startUnlock(m)" [disabled]="busy()">
                        <svg lucideLockOpen></svg> Freigeben
                      </button>
                    } @else if (m.lockable) {
                      <button class="btn btn-sm" (click)="lock(m)" [disabled]="busy()">
                        <svg lucideLock></svg> Abschließen
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class ClosingComponent {
  private readonly api = inject(ClosingApiService);
  private readonly lockState = inject(MonthLockStateService);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly months = signal<MonthClosing[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly busy = signal(false);

  protected readonly unlocking = signal<MonthClosing | null>(null);
  protected readonly unlockInput = signal('');
  protected readonly unlockPhrase = computed(() => {
    const m = this.unlocking();
    return m ? `${monthLabel(m.month)} freigeben` : '';
  });
  protected readonly unlockMatches = computed(() => this.unlockInput().trim() === this.unlockPhrase());

  protected readonly label = monthLabel;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.api.months().subscribe({
      next: (m) => {
        this.months.set(m);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected reportParams(month: string): { from: string; to: string } {
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
  }

  protected async lock(m: MonthClosing): Promise<void> {
    const note = await this.dialog.prompt({
      title: `${monthLabel(m.month)} abschließen`,
      message: `${m.entryCount} Einträge (${Math.round(m.totalSeconds / 360) / 10} h) werden schreibgeschützt, bis der Monat wieder freigegeben wird.`,
      label: 'Notiz (optional), z. B. Rechnungsnummer',
      confirmLabel: 'Abschließen',
    });
    if (note === null) return;
    this.busy.set(true);
    this.api.lock(m.month, note.trim()).subscribe({
      next: () => {
        this.toast.success(`${monthLabel(m.month)} abgeschlossen`);
        this.afterChange();
      },
      error: () => this.busy.set(false),
    });
  }

  protected startUnlock(m: MonthClosing): void {
    this.unlocking.set(m);
    this.unlockInput.set('');
  }

  protected cancelUnlock(): void {
    this.unlocking.set(null);
  }

  protected unlock(): void {
    const m = this.unlocking();
    if (!m || !this.unlockMatches()) return;
    this.busy.set(true);
    this.api.unlock(m.month).subscribe({
      next: () => {
        this.toast.success(`${monthLabel(m.month)} freigegeben`);
        this.unlocking.set(null);
        this.afterChange();
      },
      error: () => this.busy.set(false),
    });
  }

  private afterChange(): void {
    this.busy.set(false);
    this.lockState.refresh().subscribe();
    this.load();
  }
}
