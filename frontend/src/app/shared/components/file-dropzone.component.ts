import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { LucideFileUp } from '@lucide/angular';

/**
 * Drop zone for a single file: accepts drag & drop as well as click/keyboard to
 * open the native file picker. Files not matching `accept` are reported via
 * `rejected` instead of `fileSelected`.
 */
@Component({
  selector: 'app-file-dropzone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideFileUp],
  host: {
    // A file dropped next to the zone would otherwise make the browser navigate to it.
    '(document:dragover)': '$event.preventDefault()',
    '(document:drop)': '$event.preventDefault()',
  },
  template: `
    <div
      class="dropzone"
      role="button"
      [attr.tabindex]="disabled() ? -1 : 0"
      [attr.aria-disabled]="disabled()"
      [class.active]="dragging()"
      [class.disabled]="disabled()"
      (click)="open()"
      (keydown.enter)="open()"
      (keydown.space)="$event.preventDefault(); open()"
      (dragenter)="onDragOver($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <svg lucideFileUp class="icon"></svg>
      <div class="label">
        <strong>{{ label() }}</strong>
        <span class="muted">Datei hierher ziehen oder klicken zum Auswählen</span>
        @if (hint()) { <span class="hint">{{ hint() }}</span> }
      </div>
      <input #fileInput type="file" hidden [accept]="accept()" (change)="onPicked($event)" />
    </div>
  `,
  styles: [`
    .dropzone {
      display: flex; align-items: center; gap: var(--sp-4);
      padding: var(--sp-5); border: 2px dashed var(--border); border-radius: var(--radius);
      background: var(--surface-2); cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .dropzone:hover, .dropzone:focus-visible { border-color: var(--brand); outline: none; }
    .dropzone.active { border-color: var(--brand); background: var(--brand-soft); }
    .dropzone.disabled { opacity: 0.5; cursor: not-allowed; pointer-events: none; }
    .icon { width: 28px; height: 28px; flex-shrink: 0; color: var(--text-muted); }
    .dropzone.active .icon { color: var(--brand); }
    .label { display: flex; flex-direction: column; gap: 2px; font-size: var(--fs-sm); }
    .hint { font-size: var(--fs-xs); color: var(--text-faint); }
  `],
})
export class FileDropzoneComponent {
  /** Comma-separated extensions and/or MIME types, as for `<input accept>`. */
  readonly accept = input('');
  readonly label = input('Datei auswählen');
  readonly hint = input('');
  readonly disabled = input(false);

  readonly fileSelected = output<File>();
  readonly rejected = output<File>();

  protected readonly dragging = signal(false);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected open(): void {
    if (!this.disabled()) {
      this.fileInput().nativeElement.click();
    }
  }

  protected onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow selecting the same file again
    if (file) {
      this.emit(file);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.disabled()) {
      return;
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    // Ignore leave events fired when moving over child elements.
    const target = event.currentTarget as HTMLElement;
    if (!target.contains(event.relatedTarget as Node | null)) {
      this.dragging.set(false);
    }
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && !this.disabled()) {
      this.emit(file);
    }
  }

  private emit(file: File): void {
    if (this.matchesAccept(file)) {
      this.fileSelected.emit(file);
    } else {
      this.rejected.emit(file);
    }
  }

  private matchesAccept(file: File): boolean {
    const rules = this.accept().split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
    if (rules.length === 0) {
      return true;
    }
    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    return rules.some((rule) => (rule.startsWith('.') ? name.endsWith(rule) : type === rule));
  }
}
