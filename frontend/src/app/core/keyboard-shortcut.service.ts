import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { TimerStateService } from './timer-state.service';

export type ShortcutCommand = 'new-entry' | 'focus-timer' | 'focus-search' | 'start-timer';

/**
 * Global keyboard shortcuts:
 *   n → neuer Zeiteintrag, t → Timer fokussieren, s → Timer start/stop, / → Suche/Timer.
 * `s` starts via the timer bar (which focuses its input if no project is chosen yet).
 * Ignored while typing in an input/textarea/select or contenteditable element,
 * while a modal dialog is open, and for auto-repeated key events.
 * Component-level actions are emitted via `commands$`; global ones run here directly.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardShortcutService {
  private readonly timerState = inject(TimerStateService);
  private readonly commands = new Subject<ShortcutCommand>();
  readonly commands$ = this.commands.asObservable();

  private started = false;

  /** Idempotent; called once from the app shell. */
  init(): void {
    if (this.started || typeof document === 'undefined') {
      return;
    }
    this.started = true;
    document.addEventListener('keydown', (e) => this.handle(e));
  }

  private handle(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target) || isDialogOpen()) {
      return;
    }
    switch (e.key) {
      case 'n':
        e.preventDefault();
        this.commands.next('new-entry');
        break;
      case 't':
        e.preventDefault();
        this.commands.next('focus-timer');
        break;
      case '/':
        e.preventDefault();
        this.commands.next('focus-search');
        break;
      case 's':
        e.preventDefault();
        if (this.timerState.isRunning()) {
          this.timerState.stop().subscribe();
        } else {
          this.commands.next('start-timer');
        }
        break;
    }
  }
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) {
    return false;
  }
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function isDialogOpen(): boolean {
  return document.querySelector('.dialog-backdrop, [aria-modal="true"]') !== null;
}
