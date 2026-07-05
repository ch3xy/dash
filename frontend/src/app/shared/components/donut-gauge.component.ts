import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** SVG donut gauge showing a single ratio (0–1), e.g. the billable share. */
@Component({
  selector: 'app-donut-gauge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gauge-wrap">
      <svg [attr.width]="size()" [attr.height]="size()" [attr.viewBox]="'0 0 ' + size() + ' ' + size()">
        <circle class="track" [attr.cx]="c()" [attr.cy]="c()" [attr.r]="r()" [attr.stroke-width]="stroke()" />
        <circle class="fill" [attr.cx]="c()" [attr.cy]="c()" [attr.r]="r()" [attr.stroke-width]="stroke()"
                [attr.stroke-dasharray]="dash()" [attr.transform]="'rotate(-90 ' + c() + ' ' + c() + ')'" />
      </svg>
      <div class="gauge-center">
        <span class="gauge-value">{{ percentLabel() }}</span>
        @if (label()) { <span class="gauge-label">{{ label() }}</span> }
      </div>
    </div>
  `,
  styles: [`
    .gauge-wrap { position: relative; display: inline-flex; }
    circle { fill: none; }
    .track { stroke: var(--surface-2); }
    .fill { stroke: var(--brand); stroke-linecap: round; transition: stroke-dasharray 0.4s; }
    .gauge-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .gauge-value { font-size: var(--fs-xl, 1.4rem); font-weight: 700; }
    .gauge-label { font-size: var(--fs-xs, 0.7rem); color: var(--text-muted); }
  `],
})
export class DonutGaugeComponent {
  /** Ratio in [0, 1]. */
  readonly ratio = input.required<number>();
  readonly label = input('');
  readonly size = input(120);
  readonly stroke = input(12);

  protected readonly c = computed(() => this.size() / 2);
  protected readonly r = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly percentLabel = computed(
    () => `${Math.round(Math.min(Math.max(this.ratio(), 0), 1) * 100)}%`,
  );
  protected readonly dash = computed(() => {
    const circumference = 2 * Math.PI * this.r();
    const filled = Math.min(Math.max(this.ratio(), 0), 1) * circumference;
    return `${filled} ${circumference - filled}`;
  });
}
