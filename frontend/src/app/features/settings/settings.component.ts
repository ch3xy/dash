import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataIoApiService } from '../../core/api/data-io-api.service';
import { SettingsApiService } from '../../core/api/settings-api.service';
import { AppSettings, RoundingRule } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="page" style="max-width: 720px;">
      <div class="page-header"><h1>Einstellungen</h1></div>

      @if (settings(); as s) {
        <div class="card card-pad">
          <div class="card-title">Allgemein</div>
          <div class="form-row">
            <div class="field"><label>Zeitzone</label><input class="input" [(ngModel)]="s.timezone" /></div>
            <div class="field" style="max-width: 120px;"><label>Währung</label><input class="input mono" [(ngModel)]="s.currency" maxlength="3" /></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Standard-Stundensatz</label><input class="input mono" type="number" [(ngModel)]="s.defaultRate" /></div>
          </div>
          <div class="form-row">
            <div class="field">
              <label>Rundungsregel</label>
              <select class="select" [(ngModel)]="s.roundingRule">
                <option value="NONE">Keine</option>
                <option value="UP">Aufrunden</option>
                <option value="DOWN">Abrunden</option>
                <option value="NEAREST">Nächste</option>
              </select>
            </div>
            <div class="field"><label>Rundungsintervall (Min)</label><input class="input mono" type="number" [(ngModel)]="s.roundingMinutes" [disabled]="s.roundingRule === 'NONE'" /></div>
          </div>
          <button class="btn btn-primary" (click)="save(s)">Speichern</button>
        </div>
      } @else {
        <div class="state"><div class="spinner"></div></div>
      }

      <div class="card card-pad mt-4">
        <div class="card-title">Datensicherung</div>
        <p class="muted">Vollständiges JSON-Backup aller Daten herunterladen.</p>
        <button class="btn" (click)="downloadBackup()" [disabled]="busy()">⬇ Backup exportieren</button>
      </div>

      <div class="card card-pad mt-4">
        <div class="card-title">Clockify-Import</div>
        <p class="muted">Clockify-CSV-Export hochladen. Kunden, Projekte, Tasks und Tags werden automatisch angelegt.</p>
        <input type="file" accept=".csv,text/csv" (change)="onFile($event)" [disabled]="busy()" />
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private readonly api = inject(SettingsApiService);
  private readonly dataIo = inject(DataIoApiService);
  private readonly toast = inject(ToastService);

  protected readonly settings = signal<AppSettings | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    this.api.get().subscribe((s) => this.settings.set(s));
  }

  save(s: AppSettings): void {
    const payload: AppSettings = { ...s, roundingRule: s.roundingRule as RoundingRule };
    this.api.update(payload).subscribe((updated) => {
      this.settings.set(updated);
      this.toast.success('Einstellungen gespeichert');
    });
  }

  downloadBackup(): void {
    this.busy.set(true);
    this.dataIo.backup().subscribe({
      next: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dash-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.busy.set(true);
    file.text().then((csv) => {
      this.dataIo.importClockify(csv).subscribe({
        next: (res) => {
          this.toast.success(`Import: ${res.imported} importiert, ${res.skipped} übersprungen`);
          this.busy.set(false);
          input.value = '';
        },
        error: () => {
          this.busy.set(false);
          input.value = '';
        },
      });
    });
  }
}
