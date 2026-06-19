import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    title: 'Dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'timer',
    title: 'Timer',
    loadComponent: () => import('./features/timer/timer.component').then((m) => m.TimerComponent),
  },
  {
    path: 'timesheet',
    title: 'Timesheet',
    loadComponent: () =>
      import('./features/timesheet/timesheet.component').then((m) => m.TimesheetComponent),
  },
  {
    path: 'calendar',
    title: 'Kalender',
    loadComponent: () =>
      import('./features/calendar/calendar.component').then((m) => m.CalendarComponent),
  },
  {
    path: 'clients',
    title: 'Kunden',
    loadComponent: () =>
      import('./features/clients/clients.component').then((m) => m.ClientsComponent),
  },
  {
    path: 'projects',
    title: 'Projekte',
    loadComponent: () =>
      import('./features/projects/projects.component').then((m) => m.ProjectsComponent),
  },
  {
    path: 'projects/:id',
    title: 'Projekt',
    loadComponent: () =>
      import('./features/projects/project-detail.component').then((m) => m.ProjectDetailComponent),
  },
  {
    path: 'tags',
    title: 'Tags',
    loadComponent: () => import('./features/tags/tags.component').then((m) => m.TagsComponent),
  },
  {
    path: 'reports',
    title: 'Reports',
    loadComponent: () =>
      import('./features/reports/reports.component').then((m) => m.ReportsComponent),
  },
  {
    path: 'settings',
    title: 'Einstellungen',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
