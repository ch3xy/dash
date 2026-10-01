import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideCalendarDays,
  LucideChartPie,
  LucideDynamicIcon,
  LucideFolderKanban,
  LucideIcon,
  LucideLayoutDashboard,
  LucideMoon,
  LucideSettings,
  LucideSheet,
  LucideSun,
  LucideTag,
  LucideTimer,
  LucideUsers,
} from '@lucide/angular';
import { KeyboardShortcutService } from './core/keyboard-shortcut.service';
import { ThemeService } from './core/theme.service';
import { DialogHostComponent } from './core/layout/dialog-host.component';
import { GlobalSearchComponent } from './core/layout/global-search.component';
import { TimerBarComponent } from './core/layout/timer-bar.component';
import { ToastHostComponent } from './core/layout/toast-host.component';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TimerBarComponent,
    GlobalSearchComponent,
    ToastHostComponent,
    DialogHostComponent,
    LucideDynamicIcon,
    LucideTimer,
    LucideSun,
    LucideMoon,
  ],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <svg lucideTimer class="brand-mark" [size]="22" [strokeWidth]="2"></svg>
          <span class="brand-name">dash</span>
        </div>
        <nav class="sidebar-nav">
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active"
               [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }">
              <svg class="nav-icon" [lucideIcon]="item.icon" [size]="18"></svg>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="topbar-brand">
            <svg lucideTimer class="brand-mark" [size]="22" [strokeWidth]="2"></svg>
            <span class="brand-name">dash</span>
          </div>
          <app-timer-bar class="topbar-timer" />
          <div class="topbar-actions">
            <app-global-search (click)="$event.stopPropagation()" />
            <button class="btn btn-ghost btn-icon" (click)="theme.toggle()" title="Theme wechseln" aria-label="Theme wechseln">
              @if (theme.theme() === 'dark') { <svg lucideSun [size]="18"></svg> } @else { <svg lucideMoon [size]="18"></svg> }
            </button>
          </div>
        </header>
        <main class="content">
          <router-outlet />
        </main>
      </div>

      <!-- Mobile bottom navigation -->
      <nav class="bottom-nav">
        @for (item of nav; track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }">
            <svg class="nav-icon" [lucideIcon]="item.icon" [size]="18"></svg>
            <span class="bottom-nav-label">{{ item.label }}</span>
          </a>
        }
      </nav>
    </div>
    <app-toast-host />
    <app-dialog-host />
  `,
  styles: [`
    .shell { display: flex; height: 100vh; height: 100dvh; overflow: hidden; }

    /* ── Sidebar ── */
    .sidebar {
      width: 220px; flex-shrink: 0;
      background: var(--surface); border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      padding: var(--sp-4) var(--sp-3);
    }
    .brand { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3) var(--sp-5); font-weight: 700; font-size: var(--fs-xl); }
    .brand-mark { color: var(--brand); }
    .sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
    .sidebar-nav a {
      display: flex; align-items: center; gap: var(--sp-3);
      padding: var(--sp-3); border-radius: var(--radius-sm);
      color: var(--text-muted); font-weight: 500; font-size: var(--fs-md);
    }
    .sidebar-nav a:hover { background: var(--hover); color: var(--text); text-decoration: none; }
    .sidebar-nav a.active { background: var(--brand-soft); color: var(--brand); }
    .nav-icon { width: 20px; }

    /* ── Main area ── */
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

    /* ── Topbar ── */
    .topbar {
      height: 64px; flex-shrink: 0;
      border-bottom: 1px solid var(--border); background: var(--surface);
      display: flex; align-items: center; gap: var(--sp-4);
      padding: 0 var(--sp-5);
    }
    .topbar-brand { display: none; } /* shown only on mobile */
    .topbar-timer { flex: 1; min-width: 0; display: flex; }
    .topbar-actions { display: flex; align-items: center; gap: var(--sp-3); flex-shrink: 0; }
    .content { flex: 1; overflow: auto; }

    /* ── Bottom nav: desktop = hidden ── */
    .bottom-nav { display: none; }

    /* ── Narrow desktop: icon-only sidebar (641–720 px) ── */
    @media (max-width: 720px) {
      .sidebar { width: 64px; }
      .brand-name, .sidebar-nav a span:not(.nav-icon) { display: none; }
    }

    /* ── Mobile (≤ 640 px) ── */
    @media (max-width: 640px) {
      .sidebar { display: none; }

      .topbar {
        height: auto; flex-wrap: wrap;
        padding: var(--sp-2) var(--sp-4); gap: var(--sp-2);
        flex-shrink: 0;
      }
      .topbar-brand {
        display: flex; align-items: center; gap: var(--sp-2);
        font-weight: 700; font-size: var(--fs-lg); flex: 1; order: 0;
      }
      .topbar-actions { order: 1; flex-shrink: 0; }
      /* flex: 0 0 100% → flex-basis 100% forces new row (width:100% alone is ignored when flex-basis:0 is set) */
      .topbar-timer { order: 2; flex: 0 0 100%; padding-bottom: var(--sp-1); display: flex; }

      .content { padding-bottom: 56px; }

      .bottom-nav {
        display: flex;
        position: fixed; bottom: 0; left: 0; right: 0;
        height: 56px;
        background: var(--surface); border-top: 1px solid var(--border);
        z-index: 50;
        overflow-x: auto; -webkit-overflow-scrolling: touch;
      }
      .bottom-nav a {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        flex: 1; min-width: 52px;
        padding: var(--sp-1) 2px;
        color: var(--text-faint); font-size: 9px; gap: 2px;
        text-decoration: none; white-space: nowrap; transition: color 0.12s;
      }
      .bottom-nav a.active { color: var(--brand); }
    }
  `],
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly nav: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: LucideLayoutDashboard },
    { path: '/timer', label: 'Timer', icon: LucideTimer },
    { path: '/timesheet', label: 'Timesheet', icon: LucideSheet },
    { path: '/calendar', label: 'Kalender', icon: LucideCalendarDays },
    { path: '/clients', label: 'Kunden', icon: LucideUsers },
    { path: '/projects', label: 'Projekte', icon: LucideFolderKanban },
    { path: '/tags', label: 'Tags', icon: LucideTag },
    { path: '/reports', label: 'Reports', icon: LucideChartPie },
    { path: '/settings', label: 'Einstellungen', icon: LucideSettings },
  ];

  private readonly shortcuts = inject(KeyboardShortcutService);

  constructor() {
    this.theme.apply();
    this.shortcuts.init();
  }
}
