import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideLock } from '@lucide/angular';
import { MonthLockStateService, monthLabel } from '../../core/month-lock-state.service';

/**
 * Hint shown above a view whose visible period touches a closed month (Monatsabschluss).
 * Renders nothing when none of the given dates is locked.
 */
@Component({
  selector: 'app-month-locked-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideLock],
  styles: [`
    .lock-banner {
      display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap;
      background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius, 8px);
      padding: 8px 12px; margin-bottom: var(--sp-4); font-size: var(--fs-sm);
    }
    .lock-banner a { margin-left: auto; }
  `],
  template: `
    @if (months().length) {
      <div class="lock-banner" role="status">
        <svg lucideLock [size]="16"></svg>
        <span>
          <strong>{{ text() }}</strong> abgeschlossen – Einträge sind schreibgeschützt.
        </span>
        <a routerLink="/closing">Monatsabschluss</a>
      </div>
    }
  `,
})
export class MonthLockedBannerComponent {
  private readonly lockState = inject(MonthLockStateService);

  /** ISO dates (yyyy-MM-dd) of the visible period; typically its first and last day. */
  readonly dates = input.required<string[]>();

  protected readonly months = computed(() => {
    this.lockState.locks();
    const months = new Set(this.dates().filter((d) => this.lockState.isLocked(d)).map((d) => d.slice(0, 7)));
    return [...months].sort();
  });

  protected readonly text = computed(() => this.months().map(monthLabel).join(' und '));
}
