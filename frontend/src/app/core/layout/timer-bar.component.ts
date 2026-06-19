import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Project, Task } from '../models';
import { ProjectApiService } from '../api/project-api.service';
import { TaskApiService } from '../api/task-api.service';
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
        <input class="input desc" [ngModel]="t?.description ?? ''"
               (blur)="updateDescription($any($event.target).value)"
               placeholder="Woran arbeitest du?" />
        <span class="proj mono">{{ t?.projectName }}</span>
        <span class="elapsed mono">{{ timerState.elapsedSeconds() | duration }}</span>
        <button class="btn btn-danger btn-sm" (click)="stop()" title="Timer stoppen (s)">■ Stop</button>
        <button class="btn btn-ghost btn-sm" (click)="discard()" title="Verwerfen">✕</button>
      } @else {
        <input class="input desc" [(ngModel)]="description" placeholder="Woran arbeitest du?"
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
        <label class="switch" title="Abrechenbar">
          <input type="checkbox" [(ngModel)]="billable" />
          <span class="faint">€</span>
        </label>
        <button class="btn btn-primary btn-sm" (click)="start()" [disabled]="!projectId" title="Timer starten (s)">▶ Start</button>
      }
    </div>
  `,
  styles: [`
    .timer-bar { display: flex; align-items: center; gap: var(--sp-2); flex: 1; max-width: 720px; }
    .desc { flex: 1; min-width: 120px; }
    .proj-select { width: 180px; }
    .task-select { width: 130px; }
    .proj { color: var(--text-muted); font-size: var(--fs-sm); white-space: nowrap; }
    .elapsed { font-size: var(--fs-lg); font-weight: 600; min-width: 70px; text-align: right; }
  `],
})
export class TimerBarComponent {
  protected readonly timerState = inject(TimerStateService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly toast = inject(ToastService);

  protected readonly projects = signal<Project[]>([]);
  protected readonly tasks = signal<Task[]>([]);

  protected description = '';
  protected projectId: string | null = null;
  protected taskId: string | null = null;
  protected billable = true;

  constructor() {
    this.projectApi.getAll({ status: 'ACTIVE' }).subscribe((p) => this.projects.set(p));
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
      })
      .subscribe(() => {
        this.description = '';
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
