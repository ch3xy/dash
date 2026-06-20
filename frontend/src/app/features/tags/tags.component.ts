import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TagApiService } from '../../core/api/tag-api.service';
import { Tag, TagInput } from '../../core/models';
import { DialogService } from '../../core/dialog.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-tags',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Tags</h1>
        <div class="row">
          <label class="switch"><input type="checkbox" [(ngModel)]="showArchived" (ngModelChange)="load()" /> Archivierte</label>
        </div>
      </div>

      <div class="card card-pad" style="max-width: 640px;">
        <div class="row" style="margin-bottom: var(--sp-4)">
          <input class="input" [(ngModel)]="newName" placeholder="Tag-Name" (keydown.enter)="create()" />
          <input class="input" type="color" [(ngModel)]="newColor" style="width: 48px; padding: 2px;" />
          <button class="btn btn-primary" (click)="create()" [disabled]="!newName.trim()">+ Tag</button>
        </div>

        @if (loading()) {
          <div class="state"><div class="spinner"></div></div>
        } @else if (tags().length === 0) {
          <div class="muted">Noch keine Tags.</div>
        } @else {
          @for (t of tags(); track t.id) {
            <div class="row-between" style="padding: var(--sp-2) 0; border-bottom: 1px solid var(--border);">
              <span class="badge" [style.background]="(t.color || '#888') + '22'" [style.color]="t.color || 'var(--text)'">
                <span class="badge-dot" [style.background]="t.color || '#888'"></span> {{ t.name }}
              </span>
              <div class="row gap-2">
                @if (t.archived) { <span class="badge muted">Archiviert</span> }
                <button class="btn btn-ghost btn-sm" (click)="rename(t)">Umbenennen</button>
                @if (!t.archived) { <button class="btn btn-ghost btn-sm" (click)="archive(t)">Archivieren</button> }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class TagsComponent {
  private readonly api = inject(TagApiService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);

  protected readonly tags = signal<Tag[]>([]);
  protected readonly loading = signal(true);
  protected showArchived = false;
  protected newName = '';
  protected newColor = '#6366f1';

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getAll(this.showArchived).subscribe({
      next: (t) => {
        this.tags.set(t);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  create(): void {
    if (!this.newName.trim()) {
      return;
    }
    const input: TagInput = { name: this.newName.trim(), color: this.newColor };
    this.api.create(input).subscribe(() => {
      this.newName = '';
      this.toast.success('Tag erstellt');
      this.load();
    });
  }

  rename(t: Tag): void {
    this.dialog.prompt({ title: 'Tag umbenennen', label: 'Name', value: t.name }).then((name) => {
      if (name && name.trim()) {
        this.api.update(t.id, { name: name.trim(), color: t.color }).subscribe(() => this.load());
      }
    });
  }

  archive(t: Tag): void {
    this.api.archive(t.id).subscribe(() => {
      this.toast.success('Archiviert');
      this.load();
    });
  }
}
