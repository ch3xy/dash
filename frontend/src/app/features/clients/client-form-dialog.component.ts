import { ChangeDetectionStrategy, Component, inject, input, OnInit, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClientApiService } from '../../core/api/client-api.service';
import { Client, ClientInput } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { LucideX } from '@lucide/angular';

/** Create/edit dialog for client master data. `client` null means "new client". */
@Component({
  selector: 'app-client-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideX],
  template: `
    <div class="dialog-backdrop" (click)="closed.emit()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h3>{{ client() ? 'Kunde bearbeiten' : 'Neuer Kunde' }}</h3>
          <button class="btn btn-ghost btn-icon" (click)="closed.emit()" aria-label="Schließen"><svg lucideX></svg></button>
        </div>
        <div class="dialog-body">
          <div class="field">
            <label>Name *</label>
            <input class="input" [(ngModel)]="form.name" />
          </div>
          <div class="field">
            <label>Beschreibung</label>
            <textarea class="textarea" [(ngModel)]="form.description"></textarea>
          </div>
          <div class="form-row">
            <div class="field"><label>E-Mail</label><input class="input" [(ngModel)]="form.email" /></div>
            <div class="field"><label>Website</label><input class="input" [(ngModel)]="form.website" /></div>
          </div>
          <div class="field" style="max-width: 120px;">
            <label>Währung</label>
            <input class="input mono" [(ngModel)]="form.currencyCode" maxlength="3" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn" (click)="closed.emit()">Abbrechen</button>
          <button class="btn btn-primary" (click)="save()" [disabled]="!form.name?.trim()">Speichern</button>
        </div>
      </div>
    </div>
  `,
})
export class ClientFormDialogComponent implements OnInit {
  readonly client = input<Client | null>(null);
  readonly saved = output<Client>();
  readonly closed = output<void>();

  private readonly api = inject(ClientApiService);
  private readonly toast = inject(ToastService);

  protected form: ClientInput = { name: '', description: '', email: '', website: '', currencyCode: 'EUR' };

  ngOnInit(): void {
    const c = this.client();
    if (c) {
      this.form = {
        name: c.name,
        description: c.description,
        email: c.email,
        website: c.website,
        currencyCode: c.currencyCode,
      };
    }
  }

  save(): void {
    if (!this.form.name?.trim()) {
      return;
    }
    const c = this.client();
    const req = c ? this.api.update(c.id, this.form) : this.api.create(this.form);
    req.subscribe((result) => {
      this.toast.success('Gespeichert');
      this.saved.emit(result);
    });
  }
}
