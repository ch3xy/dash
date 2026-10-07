import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataIoApiService } from '../../core/api/data-io-api.service';
import { SettingsApiService } from '../../core/api/settings-api.service';
import { ClientApiService } from '../../core/api/client-api.service';
import { ProjectApiService } from '../../core/api/project-api.service';
import { DeleteCriteria, DeletePreview, TimeEntryApiService } from '../../core/api/time-entry-api.service';
import { AppSettings, Client, Project, RoundingRule } from '../../core/models';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';
import { LucideDownload, LucideTrash2 } from '@lucide/angular';
import { FileDropzoneComponent } from '../../shared/components/file-dropzone.component';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host .page { max-width: 860px; margin: 0 auto; }
    .danger-zone { border-color: var(--danger); }
    .danger-zone .card-title { color: var(--danger); }
    .danger-summary { background: var(--danger-bg); border-radius: var(--radius, 8px); padding: 12px 16px; }
  `],
  imports: [FormsModule, LucideDownload, LucideTrash2, FileDropzoneComponent, DurationPipe],
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
        <button class="btn" (click)="downloadBackup()" [disabled]="busy()"><svg lucideDownload></svg> Backup exportieren</button>
      </div>

      <div class="card card-pad mt-4">
        <div class="card-title">Wiederherstellen</div>
        <p class="muted">
          Backup-JSON hochladen. <strong>Achtung:</strong> ersetzt alle vorhandenen Daten
          unwiderruflich.
        </p>
        <app-file-dropzone
          accept=".json,application/json"
          label="Backup-Datei wiederherstellen"
          hint="JSON-Backup aus „Backup exportieren“"
          [disabled]="busy()"
          (fileSelected)="onRestoreFile($event)"
          (rejected)="onRejected($event, 'JSON')"
        />
      </div>

      <div class="card card-pad mt-4">
        <div class="card-title">Clockify-Import</div>
        <p class="muted">Clockify-CSV-Export hochladen. Kunden, Projekte, Tasks und Tags werden automatisch angelegt.</p>
        <app-file-dropzone
          accept=".csv,text/csv"
          label="Clockify-CSV importieren"
          hint="Bereits vorhandene Einträge werden als Duplikate übersprungen"
          [disabled]="busy()"
          (fileSelected)="onImportFile($event)"
          (rejected)="onRejected($event, 'CSV')"
        />
      </div>

      <div class="card card-pad mt-4 danger-zone">
        <div class="card-title">Zeiteinträge löschen</div>
        <p class="muted">
          Löscht alle Zeiteinträge nach Zeitraum, Kunde und/oder Projekt. Gesetzte Kriterien werden kombiniert.
          <strong>Achtung:</strong> Das kann nicht rückgängig gemacht werden. Erstelle vorher ein Backup.
        </p>
        <div class="form-row">
          <div class="field"><label>Von</label>
            <input class="input mono" type="date" [ngModel]="delFrom()" (ngModelChange)="delFrom.set($event); resetDelete()" /></div>
          <div class="field"><label>Bis</label>
            <input class="input mono" type="date" [ngModel]="delTo()" (ngModelChange)="delTo.set($event); resetDelete()" /></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Kunde</label>
            <select class="select" [ngModel]="delClientId()" (ngModelChange)="onDeleteClientChange($event)">
              <option value="">Alle Kunden</option>
              @for (c of clients(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
            </select>
          </div>
          <div class="field"><label>Projekt</label>
            <select class="select" [ngModel]="delProjectId()" (ngModelChange)="delProjectId.set($event); resetDelete()">
              <option value="">Alle Projekte</option>
              @for (p of deleteProjects(); track p.id) {
                <option [value]="p.id">{{ p.name }}@if (p.clientName) { · {{ p.clientName }} }</option>
              }
            </select>
          </div>
        </div>

        @if (!deletePreview()) {
          <button class="btn" (click)="loadDeletePreview()" [disabled]="!hasDeleteCriteria() || busy()">
            Betroffene Einträge ermitteln
          </button>
          @if (!hasDeleteCriteria()) { <p class="faint mt-2">Mindestens ein Kriterium wählen.</p> }
        } @else if (deletePreview(); as p) {
          @if (p.count === 0) {
            <p class="muted">Keine Einträge gefunden, die den Kriterien entsprechen.</p>
          } @else {
            <div class="danger-summary">
              <strong>{{ p.count }} Einträge</strong> ({{ p.totalSeconds | duration: 'HH:MM' }}) werden
              unwiderruflich gelöscht: {{ deleteCriteriaLabel() }}.
            </div>
            <div class="field mt-4">
              <label>Zur Bestätigung <strong class="mono">{{ confirmPhrase() }}</strong> eingeben</label>
              <input class="input mono" autocomplete="off" spellcheck="false"
                     [ngModel]="confirmInput()" (ngModelChange)="confirmInput.set($event)"
                     (keydown.enter)="confirmMatches() && runDelete()" />
            </div>
            <div class="row gap-2">
              <button class="btn btn-danger" (click)="runDelete()" [disabled]="!confirmMatches() || busy()">
                <svg lucideTrash2></svg> {{ p.count }} Einträge endgültig löschen
              </button>
              <button class="btn btn-ghost" (click)="resetDelete()">Abbrechen</button>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class SettingsComponent {
  private readonly api = inject(SettingsApiService);
  private readonly dataIo = inject(DataIoApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);
  private readonly entryApi = inject(TimeEntryApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly projectApi = inject(ProjectApiService);

  protected readonly settings = signal<AppSettings | null>(null);
  protected readonly busy = signal(false);

  protected readonly clients = signal<Client[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly delFrom = signal('');
  protected readonly delTo = signal('');
  protected readonly delClientId = signal('');
  protected readonly delProjectId = signal('');
  protected readonly deletePreview = signal<DeletePreview | null>(null);
  protected readonly confirmInput = signal('');

  protected readonly deleteProjects = computed(() => {
    const clientId = this.delClientId();
    return clientId ? this.projects().filter((p) => p.clientId === clientId) : this.projects();
  });
  protected readonly hasDeleteCriteria = computed(
    () => !!(this.delFrom() || this.delTo() || this.delClientId() || this.delProjectId()),
  );
  protected readonly confirmPhrase = computed(() => `${this.deletePreview()?.count ?? 0} Einträge löschen`);
  protected readonly confirmMatches = computed(() => this.confirmInput().trim() === this.confirmPhrase());
  protected readonly deleteCriteriaLabel = computed(() => {
    const parts: string[] = [];
    const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('de-AT');
    if (this.delFrom() && this.delTo()) parts.push(`${fmt(this.delFrom())} – ${fmt(this.delTo())}`);
    else if (this.delFrom()) parts.push(`ab ${fmt(this.delFrom())}`);
    else if (this.delTo()) parts.push(`bis ${fmt(this.delTo())}`);
    const client = this.clients().find((c) => c.id === this.delClientId());
    if (client) parts.push(`Kunde „${client.name}“`);
    const project = this.projects().find((p) => p.id === this.delProjectId());
    if (project) parts.push(`Projekt „${project.name}“`);
    return parts.join(', ');
  });

  constructor() {
    this.api.get().subscribe((s) => this.settings.set(s));
    this.clientApi.getAll(true).subscribe((c) => this.clients.set(c));
    this.projectApi.getAll({ archived: true }).subscribe((p) => this.projects.set(p));
  }

  private deleteCriteria(): DeleteCriteria {
    return {
      from: this.delFrom() || undefined,
      to: this.delTo() || undefined,
      clientId: this.delClientId() || undefined,
      projectId: this.delProjectId() || undefined,
    };
  }

  onDeleteClientChange(clientId: string): void {
    this.delClientId.set(clientId);
    // Drop a project selection that no longer belongs to the chosen client.
    if (clientId && !this.deleteProjects().some((p) => p.id === this.delProjectId())) {
      this.delProjectId.set('');
    }
    this.resetDelete();
  }

  resetDelete(): void {
    this.deletePreview.set(null);
    this.confirmInput.set('');
  }

  loadDeletePreview(): void {
    this.busy.set(true);
    this.entryApi.deletePreview(this.deleteCriteria()).subscribe({
      next: (p) => { this.deletePreview.set(p); this.busy.set(false); },
      error: () => this.busy.set(false),
    });
  }

  runDelete(): void {
    const preview = this.deletePreview();
    if (!preview || !this.confirmMatches()) return;
    this.busy.set(true);
    this.entryApi.deleteByCriteria(this.deleteCriteria(), preview.count).subscribe({
      next: (r) => {
        this.toast.success(`${r.deleted} Einträge gelöscht`);
        this.resetDelete();
        this.busy.set(false);
      },
      // 409: data changed since the preview — refresh it so the user confirms the new count.
      error: () => { this.busy.set(false); this.loadDeletePreview(); this.confirmInput.set(''); },
    });
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

  onRejected(file: File, expected: string): void {
    this.toast.error(`„${file.name}“ ist keine ${expected}-Datei.`);
  }

  onImportFile(file: File): void {
    this.busy.set(true);
    file.text().then((csv) => {
      this.dataIo.importClockify(csv).subscribe({
        next: (res) => {
          const invalid = res.warnings.length ? `, ${res.warnings.length} fehlerhaft` : '';
          this.toast.success(
            `Import: ${res.importedEntries} importiert, ${res.skippedDuplicates} Duplikate übersprungen${invalid}`,
          );
          this.busy.set(false);
        },
        error: () => this.busy.set(false),
      });
    });
  }

  onRestoreFile(file: File): void {
    this.dialog
      .confirm({
        title: 'Wiederherstellen',
        message: `Alle vorhandenen Daten werden durch das Backup „${file.name}“ ersetzt. Fortfahren?`,
        confirmLabel: 'Ersetzen',
        danger: true,
      })
      .then((ok) => {
        if (ok) {
          this.busy.set(true);
          this.runRestore(file);
        }
      });
  }

  private runRestore(file: File): void {
    file.text().then((text) => {
      let doc: unknown;
      try {
        doc = JSON.parse(text);
      } catch {
        this.toast.error('Ungültige JSON-Datei.');
        this.busy.set(false);
        return;
      }
      this.dataIo.restore(doc).subscribe({
        next: (r) => {
          this.toast.success(
            `Wiederhergestellt: ${r.projects} Projekte, ${r.timeEntries} Einträge`,
          );
          this.busy.set(false);
        },
        error: () => this.busy.set(false),
      });
    });
  }
}
