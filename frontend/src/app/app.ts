import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideCalendarDays,
  LucideChartPie,
  LucideChevronLeft,
  LucideChevronRight,
  LucideDatabase,
  LucideDynamicIcon,
  LucideFolderKanban,
  LucideIcon,
  LucideLayoutDashboard,
  LucideLock,
  LucideMenu,
  LucideMoon,
  LucideSettings,
  LucideSheet,
  LucideSun,
  LucideTag,
  LucideTimer,
  LucideUsers,
} from '@lucide/angular';
import { HealthApiService } from './core/api/health-api.service';
import { KeyboardShortcutService } from './core/keyboard-shortcut.service';
import { ThemeService } from './core/theme.service';
import { DialogHostComponent } from './core/layout/dialog-host.component';
import { GlobalSearchComponent } from './core/layout/global-search.component';
import { TimerBarComponent } from './core/layout/timer-bar.component';
import { ServerDownComponent } from './core/layout/server-down.component';
import { ToastHostComponent } from './core/layout/toast-host.component';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const COLLAPSED_KEY = 'dash-nav-collapsed';

/**
 * App shell. The sidebar follows the shared Arrow product layout (see docs/arrow-corporate-design.md):
 * logo header with collapse toggle, grouped navigation, settings in the footer, version bar.
 * Desktop: 240px, collapsible to 72px. Mobile (≤ 640px): off-canvas drawer opened from the topbar.
 */
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
    ServerDownComponent,
    LucideDynamicIcon,
    LucideChevronLeft,
    LucideChevronRight,
    LucideMenu,
    LucideSettings,
    LucideSun,
    LucideMoon,
  ],
  host: { '(document:keydown.escape)': 'drawerOpen.set(false)' },
  template: `
    <div class="shell">
      @if (drawerOpen()) {
        <div class="drawer-backdrop" (click)="drawerOpen.set(false)"></div>
      }

      <aside class="sidenav" id="sidenav" [class.collapsed]="collapsed()" [class.open]="drawerOpen()"
             aria-label="Hauptnavigation">
        <div class="nav-header">
          <a class="nav-logo" routerLink="/dashboard" (click)="closeDrawer()" aria-label="dash – zum Dashboard">
            <img [src]="theme.theme() === 'dark' ? 'logo-sidebar-dark.svg' : 'logo-sidebar.svg'" alt="" class="logo logo-full" />
            <img [src]="theme.theme() === 'dark' ? 'sidebar-min-dark.svg' : 'sidebar-min.svg'" alt="" class="logo logo-min" />
          </a>
          <button type="button" class="icon-btn collapse-btn" (click)="toggleCollapsed()"
                  [attr.aria-label]="collapsed() ? 'Navigation ausklappen' : 'Navigation einklappen'"
                  [attr.aria-expanded]="!collapsed()" [title]="collapsed() ? 'Ausklappen' : 'Einklappen'">
            @if (collapsed()) { <svg lucideChevronRight [size]="20"></svg> } @else { <svg lucideChevronLeft [size]="20"></svg> }
          </button>
        </div>

        <nav class="nav-body">
          @for (group of groups; track group.label) {
            <div class="nav-group">
              <div class="nav-group-label">{{ group.label }}</div>
              @for (item of group.items; track item.path) {
                <a class="nav-item" [routerLink]="item.path" routerLinkActive="active"
                   [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
                   [attr.aria-label]="collapsed() ? item.label : null"
                   [title]="collapsed() ? item.label : ''"
                   (click)="closeDrawer()">
                  <span class="nav-icon"><svg [lucideIcon]="item.icon" [size]="20"></svg></span>
                  <span class="nav-label">{{ item.label }}</span>
                </a>
              }
            </div>
          }
        </nav>

        <div class="nav-footer">
          <a class="nav-item nav-settings" routerLink="/settings" routerLinkActive="active"
             [attr.aria-label]="collapsed() ? 'Einstellungen' : null"
             [title]="collapsed() ? 'Einstellungen' : ''" (click)="closeDrawer()">
            <span class="nav-icon"><svg lucideSettings [size]="20"></svg></span>
            <span class="nav-label">Einstellungen</span>
          </a>
        </div>

        @if (version()) {
          <div class="nav-version">v{{ version() }}</div>
        }
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="topbar-mobile">
            <button type="button" class="icon-btn" (click)="drawerOpen.set(true)" aria-label="Menü öffnen"
                    aria-controls="sidenav" [attr.aria-expanded]="drawerOpen()">
              <svg lucideMenu [size]="22"></svg>
            </button>
            <span class="mobile-title">dash</span>
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
    </div>
    <app-toast-host />
    <app-dialog-host />
    <app-server-down />
  `,
  styles: [`
    .shell { display: flex; height: 100vh; height: 100dvh; overflow: hidden; }

    /* ── Sidenav (Arrow product layout) ── */
    .sidenav {
      width: 240px; flex-shrink: 0;
      display: flex; flex-direction: column;
      background: var(--surface); border-right: 1px solid var(--border);
      overflow: hidden;
      transition: width 0.2s ease;
    }

    .nav-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--sp-4) var(--sp-4) var(--sp-3);
      flex-shrink: 0;
    }
    .nav-logo { display: flex; align-items: center; }
    .nav-logo:hover { text-decoration: none; }
    .logo { height: 48px; width: auto; display: block; }
    .logo-min { display: none; }

    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; flex-shrink: 0;
      border: none; border-radius: 50%; background: transparent;
      color: var(--text-muted); cursor: pointer;
      transition: background-color 150ms ease, color 150ms ease;
    }
    .icon-btn:hover { background: var(--hover); color: var(--text); }

    /* Not flex: 1 — the footer sits directly below the list, only the version bar goes to the bottom */
    .nav-body { min-height: 0; overflow-y: auto; overflow-x: hidden; }
    .nav-group { margin-bottom: var(--sp-1); padding: 0 var(--sp-2); }
    .nav-group-label {
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--text-faint);
      padding: var(--sp-3) var(--sp-2) var(--sp-1);
      white-space: nowrap;
    }

    /* 8px group padding + 16px item padding + 24px icon box + 16px gap → label at 64px */
    .nav-item {
      display: flex; align-items: center; gap: var(--sp-4);
      min-height: 48px; margin: 1px 0; padding: 0 var(--sp-4);
      border-radius: var(--radius);
      color: var(--text); font-size: var(--fs-md); font-weight: 500;
      white-space: nowrap; overflow: hidden;
      transition: background-color 150ms ease, color 150ms ease;
    }
    .nav-item:hover { background: var(--hover); text-decoration: none; }
    .nav-item.active { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
    .nav-icon { display: inline-flex; justify-content: center; width: 24px; flex-shrink: 0; color: var(--text-muted); }
    .nav-item.active .nav-icon { color: var(--brand); }

    .nav-footer { flex-shrink: 0; border-top: 1px solid var(--border); padding: var(--sp-2); }
    /* Settings is a secondary entry: muted, regular weight (velo .nav-settings) */
    .nav-settings { color: var(--text-muted); font-weight: 400; }
    .nav-settings .nav-icon { color: inherit; }
    .nav-settings:hover { color: var(--text); }

    .nav-version {
      margin-top: auto; flex-shrink: 0;
      padding: var(--sp-2) var(--sp-4) var(--sp-3) calc(var(--sp-2) + var(--sp-4));
      font-size: 11px; letter-spacing: 0.03em;
      color: var(--text-faint); opacity: 0.55;
    }

    /* Collapsed (desktop only) */
    .sidenav.collapsed { width: 72px; }
    .sidenav.collapsed .nav-header {
      flex-direction: column; justify-content: center; gap: var(--sp-1);
      padding: var(--sp-3) 0 var(--sp-2);
    }
    .sidenav.collapsed .nav-group-label,
    .sidenav.collapsed .nav-label,
    .sidenav.collapsed .nav-version,
    .sidenav.collapsed .logo-full { display: none; }
    .sidenav.collapsed .logo-min { display: block; }
    .sidenav.collapsed .nav-group { padding: 0 var(--sp-1); }
    .sidenav.collapsed .nav-group + .nav-group { border-top: 1px solid var(--border); padding-top: var(--sp-1); margin-top: var(--sp-1); }
    .sidenav.collapsed .nav-item { justify-content: center; padding: 0; }
    .sidenav.collapsed .nav-footer { display: flex; flex-direction: column; align-items: center; padding: var(--sp-2) 0; }
    /* collapsed: round 40px icon button like velo's settings-icon-btn */
    .sidenav.collapsed .nav-settings { width: 40px; min-height: 40px; margin: 0; border-radius: 50%; }

    /* ── Main area ── */
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

    .topbar {
      height: 64px; flex-shrink: 0;
      border-bottom: 1px solid var(--border); background: var(--surface);
      display: flex; align-items: center; gap: var(--sp-4);
      padding: 0 var(--sp-5);
    }
    .topbar-mobile { display: none; }
    .topbar-timer { flex: 1; min-width: 0; display: flex; }
    .topbar-actions { display: flex; align-items: center; gap: var(--sp-3); flex-shrink: 0; }
    .content { flex: 1; overflow: auto; }

    .drawer-backdrop { display: none; }

    /* ── Mobile (≤ 640 px): sidenav becomes an off-canvas drawer ── */
    @media (max-width: 640px) {
      .sidenav, .sidenav.collapsed {
        position: fixed; inset: 0 auto 0 0; z-index: 60;
        width: 280px; max-width: 85vw;
        transform: translateX(-100%);
        transition: transform 0.2s ease;
        box-shadow: none;
        padding-top: env(safe-area-inset-top);
      }
      .sidenav.open { transform: none; box-shadow: var(--shadow-lg); }
      /* the drawer always shows the full layout */
      .sidenav.collapsed .nav-header { flex-direction: row; justify-content: space-between; padding: var(--sp-4) var(--sp-4) var(--sp-3); }
      .sidenav.collapsed .nav-label { display: inline; }
      .sidenav.collapsed .nav-group-label, .sidenav.collapsed .nav-version, .sidenav.collapsed .logo-full { display: block; }
      .sidenav.collapsed .logo-min { display: none; }
      .sidenav.collapsed .nav-group { padding: 0 var(--sp-2); }
      .sidenav.collapsed .nav-group + .nav-group { border-top: none; padding-top: 0; margin-top: 0; }
      .sidenav.collapsed .nav-item { justify-content: flex-start; padding: 0 var(--sp-4); }
      .sidenav.collapsed .nav-footer { display: block; padding: var(--sp-2); }
      .sidenav.collapsed .nav-settings { width: auto; min-height: 48px; margin: 1px 0; border-radius: var(--radius); }
      .collapse-btn { display: none; }

      .drawer-backdrop {
        display: block; position: fixed; inset: 0; z-index: 55;
        background: rgba(15, 23, 42, 0.4);
      }

      .topbar {
        height: auto; flex-wrap: wrap;
        padding: var(--sp-2) var(--sp-4); gap: var(--sp-2);
        padding-top: max(var(--sp-2), env(safe-area-inset-top));
      }
      .topbar-mobile { display: flex; align-items: center; gap: var(--sp-2); flex: 1; order: 0; margin-left: calc(-1 * var(--sp-2)); }
      .mobile-title { font-size: 18px; font-weight: 700; letter-spacing: -0.03em; }
      .topbar-actions { order: 1; flex-shrink: 0; }
      /* flex: 0 0 100% → flex-basis 100% forces new row (width:100% alone is ignored when flex-basis:0 is set) */
      .topbar-timer { order: 2; flex: 0 0 100%; padding-bottom: var(--sp-1); display: flex; }
      .content { padding-bottom: env(safe-area-inset-bottom, 0px); }
    }

    @media (prefers-reduced-motion: reduce) {
      .sidenav, .nav-item, .icon-btn { transition: none; }
    }
  `],
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly groups: NavGroup[] = [
    {
      label: 'Übersicht',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: LucideLayoutDashboard },
        { path: '/reports', label: 'Reports', icon: LucideChartPie },
      ],
    },
    {
      label: 'Erfassung',
      items: [
        { path: '/timer', label: 'Timer', icon: LucideTimer },
        { path: '/timesheet', label: 'Timesheet', icon: LucideSheet },
        { path: '/calendar', label: 'Kalender', icon: LucideCalendarDays },
      ],
    },
    {
      label: 'Stammdaten',
      items: [
        { path: '/clients', label: 'Kunden', icon: LucideUsers },
        { path: '/projects', label: 'Projekte', icon: LucideFolderKanban },
        { path: '/tags', label: 'Tags', icon: LucideTag },
      ],
    },
    {
      label: 'Verwaltung',
      items: [
        { path: '/closing', label: 'Monatsabschluss', icon: LucideLock },
        { path: '/data', label: 'Daten', icon: LucideDatabase },
      ],
    },
  ];

  protected readonly collapsed = signal(this.readCollapsed());
  protected readonly drawerOpen = signal(false);
  protected readonly version = toSignal(inject(HealthApiService).version(), { initialValue: null });

  private readonly shortcuts = inject(KeyboardShortcutService);

  constructor() {
    this.theme.apply();
    this.shortcuts.init();
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((c) => !c);
    try {
      globalThis.localStorage?.setItem(COLLAPSED_KEY, String(this.collapsed()));
    } catch {
      /* storage unavailable — keep in-memory state only */
    }
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  private readCollapsed(): boolean {
    try {
      return globalThis.localStorage?.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
