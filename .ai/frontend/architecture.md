# Frontend Architektur

Stack: Angular 22, Node 24 LTS, TypeScript 6, Standalone Components, Angular Signals.

---

## Verzeichnisstruktur

```
frontend/src/app/
├── core/
│   ├── api/
│   │   ├── client-api.service.ts
│   │   ├── project-api.service.ts
│   │   ├── task-api.service.ts
│   │   ├── tag-api.service.ts
│   │   ├── time-entry-api.service.ts
│   │   ├── timer-api.service.ts
│   │   ├── report-api.service.ts
│   │   ├── dashboard-api.service.ts
│   │   └── settings-api.service.ts
│   ├── layout/
│   │   ├── app-shell.component.ts     ← Root Layout
│   │   ├── sidebar.component.ts
│   │   └── topbar.component.ts        ← enthält TimerBar
│   └── error/
│       └── global-error-handler.ts
├── shared/
│   ├── components/
│   │   ├── duration-input/            ← HH:MM Eingabe
│   │   ├── project-select/            ← Autocomplete
│   │   ├── tag-select/                ← Multi-Select
│   │   ├── budget-progress/           ← Progress Bar mit Farbcodierung
│   │   ├── status-badge/              ← ACTIVE/PAUSED/etc.
│   │   └── confirm-dialog/
│   ├── pipes/
│   │   ├── duration.pipe.ts           ← Sekunden → HH:MM:SS
│   │   ├── local-date.pipe.ts
│   │   └── currency-amount.pipe.ts
│   └── utils/
│       ├── date-utils.ts
│       └── duration-utils.ts
└── features/
    ├── dashboard/
    │   └── dashboard.component.ts
    ├── timer/
    │   ├── timer.component.ts          ← Hauptseite
    │   ├── timer-bar.component.ts      ← Live-Timer in Topbar
    │   ├── time-entry-list.component.ts
    │   ├── time-entry-row.component.ts
    │   └── time-entry-form-dialog.component.ts
    ├── timesheet/
    │   ├── timesheet.component.ts
    │   └── timesheet-cell.component.ts
    ├── calendar/
    │   └── calendar.component.ts
    ├── clients/
    │   ├── clients.component.ts
    │   ├── client-list.component.ts
    │   └── client-form.component.ts
    ├── projects/
    │   ├── projects.component.ts
    │   ├── project-list.component.ts
    │   ├── project-form.component.ts
    │   ├── project-detail.component.ts
    │   ├── tasks-tab.component.ts
    │   └── rates-tab.component.ts
    ├── tags/
    │   └── tags.component.ts
    ├── reports/
    │   ├── reports.component.ts
    │   ├── report-filter-bar.component.ts
    │   ├── summary-cards.component.ts
    │   ├── report-chart.component.ts
    │   └── report-table.component.ts
    └── settings/
        └── settings.component.ts
```

---

## Routing

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard',  loadComponent: () => import('./features/dashboard/dashboard.component') },
  { path: 'timer',      loadComponent: () => import('./features/timer/timer.component') },
  { path: 'timesheet',  loadComponent: () => import('./features/timesheet/timesheet.component') },
  { path: 'calendar',   loadComponent: () => import('./features/calendar/calendar.component') },
  { path: 'clients',    loadComponent: () => import('./features/clients/clients.component') },
  { path: 'projects',   loadComponent: () => import('./features/projects/projects.component') },
  { path: 'projects/:id', loadComponent: () => import('./features/projects/project-detail.component') },
  { path: 'reports',    loadComponent: () => import('./features/reports/reports.component') },
  { path: 'settings',   loadComponent: () => import('./features/settings/settings.component') },
];
```

---

## State-Strategie

### Lokaler Component-State

```typescript
// Signals für UI-State
protected readonly loading = signal(false);
protected readonly error = signal<string | null>(null);
protected readonly clients = signal<ClientResponse[]>([]);

// In ngOnInit oder via toSignal()
protected readonly clients = toSignal(
  this.clientApi.getAll(),
  { initialValue: [] }
);
```

### Globaler Timer-State

`TimerStateService` als Singleton:

```typescript
@Injectable({ providedIn: 'root' })
export class TimerStateService {
  private readonly timerApi = inject(TimerApiService);

  readonly currentTimer = toSignal(
    interval(5000).pipe(
      startWith(0),
      switchMap(() => this.timerApi.getCurrent().pipe(catchError(() => of(null))))
    ),
    { initialValue: null }
  );
  // ...
}
```

### Filter-State in URL

```typescript
// In ReportsComponent
private readonly route = inject(ActivatedRoute);
private readonly router = inject(Router);

protected readonly filter = toSignal(
  this.route.queryParams.pipe(map(params => parseFilterFromParams(params))),
  { initialValue: defaultFilter() }
);

updateFilter(patch: Partial<ReportFilter>) {
  this.router.navigate([], {
    queryParams: { ...this.filter(), ...patch },
    queryParamsHandling: 'merge'
  });
}
```

---

## HTTP Interceptors

### API Base URL

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
  ]
};

// api-base-url.interceptor.ts
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const apiReq = req.clone({ url: `/api/v1${req.url}` });
  return next(apiReq);
};
```

### Fehler-Interceptor

```typescript
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 0) { /* Netzwerkfehler */ }
      // Globale Toast-Notification
      return throwError(() => err);
    })
  );
};
```

---

## Shared Pipes

### DurationPipe

```typescript
@Pipe({ name: 'duration', standalone: true, pure: true })
export class DurationPipe implements PipeTransform {
  transform(seconds: number | null, format: 'HH:MM:SS' | 'HH:MM' | 'decimal' = 'HH:MM:SS'): string {
    if (seconds == null) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (format === 'decimal') return (seconds / 3600).toFixed(2);
    if (format === 'HH:MM') return `${h}:${String(m).padStart(2, '0')}`;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
```

---

## Tastatur-Shortcuts

Globaler `KeyboardShortcutService`:

```typescript
@Injectable({ providedIn: 'root' })
export class KeyboardShortcutService {
  constructor() {
    fromEvent<KeyboardEvent>(document, 'keydown').pipe(
      filter(e => !e.ctrlKey && !e.metaKey && !isInputFocused())
    ).subscribe(e => {
      switch (e.key) {
        case 'n': /* neuer Zeiteintrag Dialog öffnen */ break;
        case 't': /* Timer-Bar fokussieren */ break;
        case 's': /* Timer start/stop */ break;
        case '/': /* Suche öffnen */ break;
      }
    });
  }
}
```

Registrieren in `app.config.ts` via `APP_INITIALIZER`.
