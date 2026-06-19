import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { KeyboardShortcutService } from './core/keyboard-shortcut.service';
import { ThemeService } from './core/theme.service';
import { TimerBarComponent } from './core/layout/timer-bar.component';
import { ToastHostComponent } from './core/layout/toast-host.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TimerBarComponent, ToastHostComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">⏱</span>
          <span class="brand-name">dash</span>
        </div>
        <nav>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active"
               [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }">
              <span class="nav-icon">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
      </aside>

      <div class="main">
        <header class="topbar">
          <app-timer-bar />
          <button class="btn btn-ghost btn-icon" (click)="theme.toggle()" title="Theme wechseln">
            {{ theme.theme() === 'dark' ? '☀' : '☾' }}
          </button>
        </header>
        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-toast-host />
  `,
  styles: [`
    .shell { display: flex; height: 100vh; overflow: hidden; }
    .sidebar {
      width: 220px;
      flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: var(--sp-4) var(--sp-3);
    }
    .brand {
      display: flex; align-items: center; gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3) var(--sp-5);
      font-weight: 700; font-size: var(--fs-xl);
    }
    .brand-mark { font-size: 22px; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    nav a {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-3); border-radius: var(--radius-sm);
      color: var(--text-muted); font-weight: 500; font-size: var(--fs-md);
    }
    nav a:hover { background: var(--hover); color: var(--text); text-decoration: none; }
    nav a.active { background: var(--brand-soft); color: var(--brand); }
    .nav-icon { width: 20px; text-align: center; }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .topbar {
      height: 64px; flex-shrink: 0;
      border-bottom: 1px solid var(--border); background: var(--surface);
      display: flex; align-items: center; gap: var(--sp-4);
      padding: 0 var(--sp-5);
    }
    .content { flex: 1; overflow: auto; }
    @media (max-width: 720px) {
      .sidebar { width: 64px; }
      .brand-name, nav a span:not(.nav-icon) { display: none; }
    }
  `],
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly nav: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: '◧' },
    { path: '/timer', label: 'Timer', icon: '⏱' },
    { path: '/timesheet', label: 'Timesheet', icon: '▦' },
    { path: '/calendar', label: 'Kalender', icon: '▤' },
    { path: '/clients', label: 'Kunden', icon: '☺' },
    { path: '/projects', label: 'Projekte', icon: '▣' },
    { path: '/tags', label: 'Tags', icon: '⌗' },
    { path: '/reports', label: 'Reports', icon: '◔' },
    { path: '/settings', label: 'Einstellungen', icon: '⚙' },
  ];

  private readonly shortcuts = inject(KeyboardShortcutService);

  constructor() {
    this.theme.apply();
    this.shortcuts.init();
  }
}
