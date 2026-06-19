import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface LinePoint {
  label: string;
  value: number;
}

/** Minimal responsive SVG line chart (single series). */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (points().length === 0) {
      <div class="muted">Keine Daten.</div>
    } @else {
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" class="chart">
        <polyline [attr.points]="linePoints()" fill="none" stroke="var(--brand)" stroke-width="2" />
        @for (p of coords(); track p.x) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3" fill="var(--brand)" />
        }
      </svg>
      <div class="axis">
        <span>{{ points()[0].label }}</span>
        <span>{{ points()[points().length - 1].label }}</span>
      </div>
    }
  `,
  styles: [`
    .chart { width: 100%; height: 160px; display: block; }
    .axis { display: flex; justify-content: space-between; font-size: var(--fs-xs); color: var(--text-faint); margin-top: var(--sp-1); }
  `],
})
export class LineChartComponent {
  readonly points = input.required<LinePoint[]>();
  protected readonly W = 600;
  protected readonly H = 160;

  protected readonly coords = computed(() => {
    const pts = this.points();
    const max = Math.max(...pts.map((p) => p.value), 1);
    const n = pts.length;
    const pad = 8;
    return pts.map((p, i) => ({
      x: n === 1 ? this.W / 2 : pad + (i / (n - 1)) * (this.W - 2 * pad),
      y: this.H - pad - (p.value / max) * (this.H - 2 * pad),
    }));
  });

  protected readonly linePoints = computed(() =>
    this.coords()
      .map((c) => `${c.x},${c.y}`)
      .join(' '),
  );
}
