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
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { ClientApiService } from '../api/client-api.service';
import { ProjectApiService } from '../api/project-api.service';
import { TimeEntryApiService } from '../api/time-entry-api.service';
import { Client, Project, TimeEntry } from '../models';
import { KeyboardShortcutService } from '../keyboard-shortcut.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';

@Component({
  selector: 'app-global-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DurationPipe],
  template: `
    <div class="search-wrap">
      <input #input class="search-input" [(ngModel)]="query"
             (ngModelChange)="onQuery($event)"
             (keydown.escape)="close()"
             (keydown.arrowdown)="focusFirst()"
             placeholder="Suche… (Einträge, Projekte, Kunden)" />
      @if (open() && (entries().length || projects().length || clients().length)) {
        <div class="search-panel" (click)="$event.stopPropagation()">
          @if (entries().length) {
            <div class="search-section">Zeiteinträge</div>
            @for (e of entries(); track e.id) {
              <button class="search-item" (click)="goEntry(e)">
                <span class="si-title">{{ e.description || '(keine Beschreibung)' }}</span>
                <span class="si-meta">{{ e.projectName }} · {{ e.entryDate }} · {{ e.durationSeconds | duration: 'HH:MM' }}</span>
              </button>
            }
          }
          @if (projects().length) {
            <div class="search-section">Projekte</div>
            @for (p of projects(); track p.id) {
              <button class="search-item" (click)="goProject(p)">
                <span class="si-dot" [style.background]="p.color || 'var(--brand)'"></span>
                <span class="si-title">{{ p.name }}</span>
                @if (p.clientName) { <span class="si-meta">{{ p.clientName }}</span> }
              </button>
            }
          }
          @if (clients().length) {
            <div class="search-section">Kunden</div>
            @for (c of clients(); track c.id) {
              <button class="search-item" (click)="goClient(c)">
                <span class="si-title">{{ c.name }}</span>
              </button>
            }
          }
          @if (!entries().length && !projects().length && !clients().length) {
            <div class="search-empty">Keine Ergebnisse für „{{ query }}"</div>
          }
        </div>
      }
      @if (open() && query.length > 0 && !entries().length && !projects().length && !clients().length && !loading()) {
        <div class="search-panel">
          <div class="search-empty">Keine Ergebnisse für „{{ query }}"</div>
        </div>
      }
    </div>
  `,
  styles: [`
    .search-wrap { position: relative; }
    .search-input {
      width: 260px; padding: 6px 12px; border-radius: var(--radius);
      border: 1px solid var(--border); background: var(--bg);
      font-size: var(--fs-sm); color: var(--text);
      transition: width 0.2s, box-shadow 0.15s;
    }
    .search-input:focus { width: 320px; outline: none; box-shadow: 0 0 0 2px var(--brand); }
    .search-panel {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 200;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); box-shadow: var(--shadow-md);
      min-width: 320px; max-height: 420px; overflow-y: auto;
      padding: var(--sp-1) 0;
    }
    .search-section {
      padding: var(--sp-1) var(--sp-3); font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint);
    }
    .search-item {
      display: flex; align-items: center; gap: var(--sp-2);
      width: 100%; padding: var(--sp-2) var(--sp-3);
      background: none; border: none; text-align: left; cursor: pointer;
      color: var(--text); font-size: var(--fs-sm);
    }
    .search-item:hover { background: var(--hover); }
    .si-title { font-weight: 500; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .si-meta { font-size: var(--fs-xs); color: var(--text-muted); white-space: nowrap; }
    .si-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .search-empty { padding: var(--sp-3); color: var(--text-muted); font-size: var(--fs-sm); text-align: center; }
  `],
})
export class GlobalSearchComponent {
  private readonly entryApi = inject(TimeEntryApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly router = inject(Router);
  private readonly shortcuts = inject(KeyboardShortcutService);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');

  protected query = '';
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly entries = signal<TimeEntry[]>([]);
  protected readonly projects = signal<Project[]>([]);
  protected readonly clients = signal<Client[]>([]);

  private readonly query$ = new Subject<string>();
  private allProjects: Project[] = [];
  private allClients: Client[] = [];

  constructor() {
    this.projectApi.getAll({}).subscribe((p) => (this.allProjects = p));
    this.clientApi.getAll().subscribe((c) => (this.allClients = c));

    this.shortcuts.commands$.pipe(takeUntilDestroyed()).subscribe((cmd) => {
      if (cmd === 'focus-search') {
        this.open.set(true);
        setTimeout(() => this.input()?.nativeElement.focus(), 50);
      }
    });

    this.query$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q.trim()) {
            this.entries.set([]);
            this.projects.set([]);
            this.clients.set([]);
            this.loading.set(false);
            return [];
          }
          this.loading.set(true);
          const lower = q.toLowerCase();
          this.projects.set(
            this.allProjects.filter((p) => p.name.toLowerCase().includes(lower)).slice(0, 5),
          );
          this.clients.set(
            this.allClients.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 4),
          );
          return this.entryApi.list({ q, size: 6 });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        if ('content' in page) {
          this.entries.set(page.content);
        }
        this.loading.set(false);
      });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.close();
  }

  protected onQuery(value: string): void {
    this.open.set(true);
    this.query$.next(value);
  }

  protected close(): void {
    this.open.set(false);
    this.query = '';
    this.entries.set([]);
    this.projects.set([]);
    this.clients.set([]);
  }

  protected focusFirst(): void {
    const panel = document.querySelector('.search-panel .search-item') as HTMLElement | null;
    panel?.focus();
  }

  protected goEntry(e: TimeEntry): void {
    this.router.navigate(['/timer'], { queryParams: { date: e.entryDate } });
    this.close();
  }

  protected goProject(p: Project): void {
    this.router.navigate(['/projects', p.id]);
    this.close();
  }

  protected goClient(c: Client): void {
    this.router.navigate(['/clients', c.id]);
    this.close();
  }
}
