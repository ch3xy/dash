import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
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
        <div class="dialog" style="max-width: 440px;" (click)="$event.stopPropagation()">
          <div class="dialog-header"><h3>{{ r.title }}</h3></div>
          <div class="dialog-body">
            @if (r.message) { <p style="margin: 0 0 var(--sp-3)">{{ r.message }}</p> }
            @if (r.kind === 'prompt') {
              @if (r.label) { <label class="muted" style="font-size: var(--fs-sm)">{{ r.label }}</label> }
              <input class="input" appAutofocus [(ngModel)]="value" [placeholder]="r.placeholder ?? ''"
                     (keydown.enter)="confirm()" (keydown.escape)="cancel()" />
            }
          </div>
          <div class="dialog-footer">
            <button class="btn" (click)="cancel()">{{ r.cancelLabel }}</button>
            <button class="btn" [class.btn-danger]="r.danger" [class.btn-primary]="!r.danger"
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

  constructor() {
    effect(() => {
      const r = this.dialog.request();
      if (r) {
        this.value.set(r.initialValue);
      }
    });
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
