import { Pipe, PipeTransform } from '@angular/core';

export type DurationFormat = 'HH:MM:SS' | 'HH:MM' | 'decimal' | 'compact';

/** Formats a number of seconds as a human-readable duration. */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(seconds: number | null | undefined, format: DurationFormat = 'HH:MM:SS'): string {
    if (seconds == null) {
      return '--:--';
    }
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;

    switch (format) {
      case 'decimal':
        return (total / 3600).toFixed(2);
      case 'HH:MM':
        return `${h}:${pad(m)}`;
      case 'compact':
        return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
      default:
        return `${h}:${pad(m)}:${pad(s)}`;
    }
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
