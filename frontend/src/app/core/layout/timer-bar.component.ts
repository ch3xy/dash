import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Project, Tag, Task } from '../models';
import { ProjectApiService } from '../api/project-api.service';
import { TagApiService } from '../api/tag-api.service';
import { TaskApiService } from '../api/task-api.service';
import { KeyboardShortcutService } from '../keyboard-shortcut.service';
import { TimerStateService } from '../timer-state.service';
import { ToastService } from '../toast.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';

@Component({
  selector: 'app-timer-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DurationPipe],
  template: `
    <div class="timer-bar">
      @if (timerState.isRunning(); as _) {
        @let t = timerState.timer();
        <input #descInput class="input desc" [ngModel]="t?.description ?? ''"
               (blur)="updateDescription($any($event.target).value)"
               placeholder="Woran arbeitest du?" />
        <span class="proj mono">{{ t?.projectName }}</span>
        <span class="elapsed mono">{{ timerState.elapsedSeconds() | duration }}</span>
        <button class="btn btn-danger btn-sm" (click)="stop()" title="Timer stoppen (s)">■ Stop</button>
        <button class="btn btn-ghost btn-sm" (click)="discard()" title="Verwerfen">✕</button>
      } @else {
        <input #descInput class="input desc" [(ngModel)]="description" placeholder="Woran arbeitest du?"
               (keydown.enter)="start()" />
        <select class="select proj-select" [(ngModel)]="projectId" (ngModelChange)="onProjectChange()">
          <option [ngValue]="null" disabled>Projekt wählen…</option>
          @for (p of projects(); track p.id) {
            <option [ngValue]="p.id">{{ p.clientName ? p.clientName + ' · ' : '' }}{{ p.name }}</option>
          }
        </select>
        @if (tasks().length) {
          <select class="select task-select" [(ngModel)]="taskId">
            <option [ngValue]="null">— Task —</option>
            @for (tk of tasks(); track tk.id) {
              <option [ngValue]="tk.id">{{ tk.name }}</option>
            }
          </select>
        }

        <!-- Tag picker -->
        @if (allTags().length) {
          <div class="tag-wrap">
            <button type="button" class="btn btn-ghost btn-sm tag-btn"
                    (click)="toggleTagPanel($event)"
                    [class.tag-btn-active]="selectedTagIds().length > 0">
              🏷
              @if (selectedTagIds().length > 0) {
                <span class="tag-count">{{ selectedTagIds().length }}</span>
              }
            </button>
            @if (showTagPanel()) {
              <div class="tag-panel" (click)="$event.stopPropagation()">
                @for (t of allTags(); track t.id) {
                  <button type="button" class="tag-option"
                          [class.tag-option-sel]="selectedTagIds().includes(t.id)"
                          [style.--dot]="t.color || 'var(--brand)'"
                          (click)="toggleTag(t.id)">
                    <span class="tag-dot"></span>{{ t.name }}
                  </button>
                }
              </div>
            }
          </div>
        }

        <label class="switch" title="Abrechenbar">
          <input type="checkbox" [(ngModel)]="billable" />
          <span class="faint">€</span>
        </label>
        <button class="btn btn-primary btn-sm" (click)="start()" [disabled]="!projectId" title="Timer starten (s)">▶ Start</button>
      }
    </div>
  `,
  styles: [`
    .timer-bar { display: flex; align-items: center; gap: var(--sp-2); flex: 1; max-width: 800px; width: 100%; }
    .desc { flex: 1; min-width: 100px; }
    .proj-select { width: 180px; }
    .task-select { width: 130px; }
    .proj { color: var(--text-muted); font-size: var(--fs-sm); white-space: nowrap; }
    .elapsed { font-size: var(--fs-lg); font-weight: 600; min-width: 70px; text-align: right; }

    @media (max-width: 640px) {
      .timer-bar { flex-wrap: wrap; max-width: none; gap: var(--sp-2); }
      /* Row 1: description full-width */
      .desc { order: 0; flex-basis: 100%; min-width: 0; }
      /* Row 2: project select (grows), then task, then billable toggle, then start */
      .proj-select { order: 1; flex: 1; width: auto; min-width: 0; }
      .task-select { order: 2; flex: 1; width: auto; min-width: 0; }
      .switch    { order: 3; flex-shrink: 0; }
      .btn-primary { order: 4; flex-shrink: 0; }
      /* Running mode: hide project label, keep elapsed + stop inline */
      .proj { display: none; }
    }
    .tag-wrap { position: relative; }
    .tag-btn { gap: 4px; }
    .tag-btn-active { color: var(--brand); background: color-mix(in srgb, var(--brand) 10%, transparent); }
    .tag-count { background: var(--brand); color: #fff; border-radius: 99px;
                 font-size: 10px; padding: 0 4px; line-height: 16px; }
    .tag-panel { position: absolute; top: calc(100% + 4px); left: 0; z-index: 100;
                 background: var(--surface); border: 1px solid var(--border);
                 border-radius: var(--radius); box-shadow: var(--shadow-md);
                 padding: var(--sp-2); display: flex; flex-direction: column; gap: 2px;
                 min-width: 140px; max-height: 240px; overflow-y: auto; }
    .tag-option { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-1) var(--sp-2);
                  border-radius: var(--radius-sm); font-size: var(--fs-sm); text-align: left;
                  background: none; border: none; cursor: pointer; color: var(--text); white-space: nowrap; }
    .tag-option:hover { background: var(--hover); }
    .tag-option-sel { background: color-mix(in srgb, var(--brand) 10%, transparent); font-weight: 600; }
    .tag-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dot); flex-shrink: 0; }
  `],
})
export class TimerBarComponent {
  protected readonly timerState = inject(TimerStateService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly tagApi = inject(TagApiService);
  private readonly toast = inject(ToastService);
  private readonly shortcuts = inject(KeyboardShortcutService);

  private readonly descInput = viewChild<ElementRef<HTMLInputElement>>('descInput');
  protected readonly projects = signal<Project[]>([]);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly allTags = signal<Tag[]>([]);
  protected readonly selectedTagIds = signal<string[]>([]);
  protected readonly showTagPanel = signal(false);

  protected description = '';
  protected projectId: string | null = null;
  protected taskId: string | null = null;
  protected billable = true;

  constructor() {
    this.projectApi.getAll({ status: 'ACTIVE' }).subscribe((p) => this.projects.set(p));
    this.tagApi.getAll().subscribe((t) => this.allTags.set(t));
    this.shortcuts.commands$.pipe(takeUntilDestroyed()).subscribe((cmd) => {
      if (cmd === 'focus-timer') {
        this.descInput()?.nativeElement.focus();
      }
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showTagPanel.set(false);
  }

  protected toggleTagPanel(e: MouseEvent): void {
    e.stopPropagation();
    this.showTagPanel.update((v) => !v);
  }

  protected toggleTag(id: string): void {
    this.selectedTagIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  onProjectChange(): void {
    this.taskId = null;
    this.tasks.set([]);
    if (this.projectId) {
      this.taskApi.getForProject(this.projectId).subscribe((t) => this.tasks.set(t));
    }
  }

  start(): void {
    if (!this.projectId) {
      return;
    }
    this.timerState
      .start({
        projectId: this.projectId,
        taskId: this.taskId,
        description: this.description || null,
        billable: this.billable,
        tagIds: this.selectedTagIds(),
      })
      .subscribe(() => {
        this.description = '';
        this.selectedTagIds.set([]);
        this.showTagPanel.set(false);
        this.toast.success('Timer gestartet');
      });
  }

  stop(): void {
    this.timerState.stop().subscribe(() => this.toast.success('Eintrag gespeichert'));
  }

  discard(): void {
    this.timerState.discard().subscribe(() => this.toast.show('Timer verworfen'));
  }

  updateDescription(value: string): void {
    if (this.timerState.isRunning()) {
      this.timerState.patch({ description: value || null }).subscribe();
    }
  }
}
