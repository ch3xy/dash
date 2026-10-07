import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface DonutSegment {
  label: string;
  display: string;
  color: string;
  fraction: number;
}

const SIZE = 200;
const STROKE = 36;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const GAP_PX = 2; // gap between segments in px on the arc

/**
 * Multi-segment SVG donut.
 * Each segment is rendered as a stroked circle offset so only its arc is visible.
 * Requires segments[] whose fractions sum to ≤ 1 (remainder is shown as an empty track).
 */
@Component({
  selector: 'app-report-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-wrap">
      <svg [attr.viewBox]="'0 0 ' + SIZE + ' ' + SIZE" class="donut-svg" aria-hidden="true">
        <!-- Empty track -->
        <circle class="donut-track" [attr.cx]="CX" [attr.cy]="CY" [attr.r]="R" [attr.stroke-width]="STROKE" />
        <!-- Colored segments -->
        @for (seg of placed(); track seg.label; let i = $index) {
          <circle
            [attr.cx]="CX" [attr.cy]="CY" [attr.r]="R"
            [attr.stroke]="seg.color"
            [attr.stroke-width]="STROKE"
            [attr.stroke-dasharray]="seg.dash"
            [attr.stroke-dashoffset]="seg.offset"
            transform="rotate(-90 100 100)"
            fill="none"
          />
        }
      </svg>
      <div class="donut-center">
        <div class="donut-total">{{ centerLabel() }}</div>
        @if (centerSub()) { <div class="donut-sub">{{ centerSub() }}</div> }
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; align-items: center; }
    .donut-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; }
    .donut-svg { display: block; width: 200px; height: 200px; }
    .donut-track { fill: none; stroke: var(--surface-2, var(--border)); }
    .donut-center { position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none; }
    .donut-total { font-size: var(--fs-xl); font-weight: 700; letter-spacing: -0.02em; }
    .donut-sub { font-size: var(--fs-xs); color: var(--text-muted); }
  `],
})
export class ReportDonutComponent {
  readonly segments = input.required<DonutSegment[]>();
  readonly centerLabel = input('');
  readonly centerSub = input('');

  protected readonly SIZE = SIZE;
  protected readonly CX = CX;
  protected readonly CY = CY;
  protected readonly R = R;
  protected readonly STROKE = STROKE;

  protected readonly placed = computed(() => {
    const segs = this.segments();
    if (!segs.length) return [];
    const gapFraction = GAP_PX / CIRCUMFERENCE;
    let cursor = 0;
    return segs.map((s) => {
      const effectiveFraction = Math.max(0, s.fraction - gapFraction);
      const dash = `${effectiveFraction * CIRCUMFERENCE} ${(1 - effectiveFraction) * CIRCUMFERENCE}`;
      const offset = -(cursor * CIRCUMFERENCE);
      cursor += s.fraction;
      return { ...s, dash, offset };
    });
  });
}
