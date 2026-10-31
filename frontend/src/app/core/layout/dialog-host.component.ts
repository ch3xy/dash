import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../dialog.service';
import { AutofocusDirective } from '../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-dialog-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AutofocusDirective],
  template: `
    @if (dialog.request(); as r) {
      <div class="dialog-backdrop" (click)="cancel()">
        <div class="dialog" style="max-width: 440px;" role="dialog" aria-modal="true"
             aria-labelledby="app-dialog-title" (click)="$event.stopPropagation()"
             (keydown.escape)="cancel()" (keydown.tab)="trapFocus($event, false)"
             (keydown.shift.tab)="trapFocus($event, true)">
          <div class="dialog-header"><h3 id="app-dialog-title">{{ r.title }}</h3></div>
          <div class="dialog-body">
            @if (r.message) { <p style="margin: 0 0 var(--sp-3)">{{ r.message }}</p> }
            @if (r.kind === 'prompt') {
              @if (r.label) { <label class="muted" style="font-size: var(--fs-sm)">{{ r.label }}</label> }
              <input class="input" appAutofocus [(ngModel)]="value" [placeholder]="r.placeholder ?? ''"
                     (keydown.enter)="confirm()" (keydown.escape)="cancel()" />
            }
          </div>
          <div class="dialog-footer">
            <button class="btn" [attr.data-initial-focus]="r.kind === 'confirm' && r.danger ? '' : null" (click)="cancel()">{{ r.cancelLabel }}</button>
            <button class="btn" [class.btn-danger]="r.danger" [class.btn-primary]="!r.danger"
                    [attr.data-initial-focus]="r.kind === 'confirm' && !r.danger ? '' : null"
                    (click)="confirm()">{{ r.confirmLabel }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DialogHostComponent {
  protected readonly dialog = inject(DialogService);
  protected readonly value = signal('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previousFocus: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const r = this.dialog.request();
      if (r) {
        this.value.set(r.initialValue);
        this.previousFocus ??= document.activeElement as HTMLElement | null;
        // Confirm: focus the safe/default button (prompt focuses its input via appAutofocus).
        queueMicrotask(() =>
          this.host.nativeElement.querySelector<HTMLElement>('[data-initial-focus]')?.focus());
      } else if (this.previousFocus) {
        this.previousFocus.focus();
        this.previousFocus = null;
      }
    });
  }

  /** Keeps Tab / Shift+Tab inside the dialog. */
  protected trapFocus(e: Event, backwards: boolean): void {
    const focusable = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>('.dialog input, .dialog button:not([disabled])'),
    );
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (backwards && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!backwards && active === last) {
      e.preventDefault();
      first.focus();
    } else if (!focusable.includes(active as HTMLElement)) {
      e.preventDefault();
      first.focus();
    }
  }

  protected confirm(): void {
    const r = this.dialog.request();
    if (!r) {
      return;
    }
    r.resolve(r.kind === 'prompt' ? this.value() : true);
    this.dialog.request.set(null);
  }

  protected cancel(): void {
    const r = this.dialog.request();
    if (!r) {
      return;
    }
    r.resolve(r.kind === 'prompt' ? null : false);
    this.dialog.request.set(null);
  }
}
