import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SettingsApiService } from '../../core/api/settings-api.service';
import { AppSettings, RoundingRule } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host .page { max-width: 860px; margin: 0 auto; }`],
  imports: [FormsModule, RouterLink],
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

      <p class="faint mt-4">Backup, Wiederherstellen, Clockify-Import und Löschen von Zeiteinträgen: <a routerLink="/data">Daten</a></p>
    </div>
  `,
})
export class SettingsComponent {
  private readonly api = inject(SettingsApiService);
  private readonly toast = inject(ToastService);

  protected readonly settings = signal<AppSettings | null>(null);

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
}
