import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
  display?: string;
}

/** Horizontal bar chart rendered with plain HTML/CSS — no chart library. */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (data().length === 0) {
      <div class="muted">Keine Daten.</div>
    } @else {
      @for (d of data(); track d.label) {
        <div class="bar-row">
          <div class="bar-label" [title]="d.label">{{ d.label }}</div>
          <div class="bar-track">
            <div class="bar-fill" [style.width.%]="pct(d.value)"></div>
          </div>
          <div class="bar-value mono">{{ d.display ?? d.value }}</div>
        </div>
      }
    }
  `,
  styles: [`
    .bar-row { display: grid; grid-template-columns: 160px 1fr 90px; align-items: center; gap: var(--sp-3); padding: var(--sp-1) 0; }
    .bar-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--fs-sm); }
    .bar-track { background: var(--surface-2); border-radius: 999px; height: 14px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--brand); border-radius: 999px; min-width: 2px; transition: width 0.3s; }
    .bar-value { text-align: right; font-size: var(--fs-sm); color: var(--text-muted); }
  `],
})
export class BarChartComponent {
  readonly data = input.required<BarDatum[]>();
  private readonly max = computed(() => Math.max(...this.data().map((d) => d.value), 1));

  pct(value: number): number {
    return (value / this.max()) * 100;
  }
}
