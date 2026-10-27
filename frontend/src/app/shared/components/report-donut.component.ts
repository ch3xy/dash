import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface DonutSegment {
  label: string;
  display: string;
  color: string;
  fraction: number;
}

/** Hovered segment with the pointer position (viewport coordinates) for a tooltip. */
export interface DonutHover {
  index: number;
  clientX: number;
  clientY: number;
}

const SIZE = 200;
const STROKE = 36;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const GAP_PX = 2; // gap between segments in px on the arc

/**
 * Index of the segment under a point given in viewBox units, or null when the
 * point is off the ring. Segments run clockwise from 12 o'clock.
 */
export function segmentAt(fractions: number[], x: number, y: number): number | null {
  const dx = x - CX;
  const dy = y - CY;
  const dist = Math.hypot(dx, dy);
  if (dist < R - STROKE / 2 || dist > R + STROKE / 2) return null;
  const angle = Math.atan2(dx, -dy);
  const pos = (angle < 0 ? angle + 2 * Math.PI : angle) / (2 * Math.PI);
  let cursor = 0;
  for (let i = 0; i < fractions.length; i++) {
    cursor += fractions[i];
    if (pos < cursor) return i;
  }
  return null;
}

/**
 * Multi-segment SVG donut.
 * Each segment is rendered as a stroked circle offset so only its arc is visible.
 * Requires segments[] whose fractions sum to ≤ 1 (remainder is shown as an empty track).
 * Hovering a segment emits {@link segmentHover}; {@link highlight} emphasises one segment
 * and shows it in the centre (also driven by an external legend).
 */
@Component({
  selector: 'app-report-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut-wrap">
      <svg [attr.viewBox]="'0 0 ' + SIZE + ' ' + SIZE" class="donut-svg" aria-hidden="true"
           (mousemove)="onMove($event)" (mouseleave)="segmentHover.emit(null)">
        <!-- Empty track -->
        <circle class="donut-track" [attr.cx]="CX" [attr.cy]="CY" [attr.r]="R" [attr.stroke-width]="STROKE" />
        <!-- Colored segments -->
        @for (seg of placed(); track seg.label; let i = $index) {
          <circle
            class="donut-seg"
            [class.dimmed]="highlight() !== null && highlight() !== i"
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
        @if (highlighted(); as h) {
          <div class="donut-total">{{ h.display }}</div>
          <div class="donut-sub donut-sub-label">{{ h.label }}</div>
        } @else {
          <div class="donut-total">{{ centerLabel() }}</div>
          @if (centerSub()) { <div class="donut-sub">{{ centerSub() }}</div> }
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; align-items: center; }
    .donut-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; }
    .donut-svg { display: block; width: 200px; height: 200px; }
    .donut-track { fill: none; stroke: var(--surface-2, var(--border)); }
    .donut-seg { transition: opacity 150ms; }
    .donut-seg.dimmed { opacity: 0.3; }
    .donut-center { position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; pointer-events: none; }
    .donut-total { font-size: var(--fs-xl); font-weight: 700; letter-spacing: -0.02em; }
    .donut-sub { font-size: var(--fs-xs); color: var(--text-muted); }
    .donut-sub-label { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
})
export class ReportDonutComponent {
  readonly segments = input.required<DonutSegment[]>();
  readonly centerLabel = input('');
  readonly centerSub = input('');
  /** Index of the segment to emphasise, or null. */
  readonly highlight = input<number | null>(null);
  readonly segmentHover = output<DonutHover | null>();

  protected readonly SIZE = SIZE;
  protected readonly CX = CX;
  protected readonly CY = CY;
  protected readonly R = R;
  protected readonly STROKE = STROKE;

  protected readonly highlighted = computed(() => {
    const i = this.highlight();
    return i === null ? null : (this.segments()[i] ?? null);
  });

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

  protected onMove(event: MouseEvent): void {
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const scale = SIZE / rect.width;
    const index = segmentAt(
      this.segments().map((s) => s.fraction),
      (event.clientX - rect.left) * scale,
      (event.clientY - rect.top) * scale,
    );
    this.segmentHover.emit(index === null ? null : { index, clientX: event.clientX, clientY: event.clientY });
  }
}
