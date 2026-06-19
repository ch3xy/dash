# Tickets — Priorisierte Implementierungsliste

Format: `[PHASE-NR] Titel — Dateien/Klassen die erstellt/geändert werden`

---

## Phase 0 — Setup

### T0-1: Docker Compose + Flyway Bootstrap
- Erstelle `docker-compose.yml` im Repo-Root
- Erstelle `src/main/resources/db/migration/V1__init_schema.sql` (komplettes Schema aus [datamodel.md](datamodel.md))
- Konfiguriere Flyway in `application.yml`

### T0-2: Spring Boot Error-Handling
- Erstelle `common/error/GlobalExceptionHandler.java` (`@RestControllerAdvice`)
- Mappt `ConstraintViolationException` → 422, `EntityNotFoundException` → 404, allg. Exception → 500
- Nutzt Spring 6 `ProblemDetail` nativ

### T0-3: Health Endpoint
- Erstelle `app/HealthController.java`: `GET /api/v1/health` → `{"status":"UP","timestamp":"..."}`

### T0-4: CORS Konfiguration
- Erstelle `app/WebConfig.java` (`WebMvcConfigurer`)
- Erlaubt `http://localhost:4200` für alle Endpunkte

### T0-5: Angular App Shell
- `AppComponent` mit Router-Outlet
- `LayoutComponent`: Sidebar (Navigation) + Topbar + Content
- Basis-Routing: `/dashboard`, `/timer`, `/clients`, `/projects`, `/reports`, `/settings`
- `ApiService`: Basis-HttpClient mit `baseUrl`

---

## Phase 1 — Stammdaten

### T1-1: Client CRUD Backend
- `Client.java` (Entity)
- `ClientRepository.java` (JpaRepository)
- `ClientService.java` (create, update, archive, delete, findAll)
- `ClientController.java` (alle 5 Endpunkte, s. [api.md](api.md))
- `ClientRequest.java`, `ClientResponse.java` (DTOs)
- Unique-Check auf `lower(name) where archived = false`

### T1-2: Project CRUD Backend
- `Project.java`, `ProjectRate.java` (Entities)
- `ProjectRepository.java`, `ProjectRateRepository.java`
- `ProjectService.java` (inkl. `addRate`, `getActiveRate`)
- `ProjectController.java`
- `ProjectRequest.java`, `ProjectResponse.java`, `ProjectRateRequest.java`, `ProjectRateResponse.java`
- Beim `addRate`: schließe aktive Rate ab (`validTo = newRate.validFrom`)

### T1-3: Task CRUD Backend
- `Task.java`, `TaskRepository.java`, `TaskService.java`, `TaskController.java`
- DTOs: `TaskRequest.java`, `TaskResponse.java`
- Unique-Check auf `lower(name) per project_id`

### T1-4: Tag CRUD Backend
- `Tag.java`, `TagRepository.java`, `TagService.java`, `TagController.java`
- DTOs: `TagRequest.java`, `TagResponse.java`

### T1-5: AppSettings Backend
- `AppSetting.java` (Entity, `@Id String key`)
- `AppSettingsRepository.java`
- `AppSettingsService.java` (typed getters: `getTimezone()`, `getCurrency()`, etc.)
- `AppSettingsController.java`: `GET /settings`, `PUT /settings`

### T1-6: Clients Frontend
- `ClientApiService`: alle API-Calls
- `ClientsListComponent`: Tabelle mit Name, Archiviert-Badge, Edit/Archive-Aktionen
- `ClientFormComponent`: Dialog/Drawer für Anlegen + Bearbeiten
- Route: `/clients`

### T1-7: Projects Frontend
- `ProjectApiService`
- `ProjectsListComponent`: Karte/Tabelle mit Status-Badge, Budget-Balken
- `ProjectFormComponent`
- `ProjectDetailComponent`: Tabs (Tasks, Raten, Budget-Status)
- `TasksTabComponent`: Task-Liste + Inline-Formular
- `RatesTabComponent`: Rate-Historie + Neue Rate hinzufügen
- Route: `/projects`, `/projects/:id`

---

## Phase 2 — Time Tracking

### T2-1: TimeEntry Entity + Repository
- `TimeEntry.java`, `TimeEntryTag.java` (ManyToMany Join)
- `TimeEntryRepository.java` mit Custom-Query für Filter
- Flyway V6 + V7

### T2-2: RunningTimer Entity + Repository
- `RunningTimer.java`
- `RunningTimerRepository.java` (findet max 1 Eintrag via `findFirst`)
- Flyway V8

### T2-3: RateResolver Service
- `RateResolverService.java`
- Implementiert Priorität: Task-Rate → aktive Project-Rate → Project-Default → App-Default
- Gibt `ResolvedRate(BigDecimal hourlyRate, String currencyCode)` zurück

### T2-4: TimerService
- `TimerService.java`
- `start(TimerStartRequest)`: prüft ob Timer läuft (409 wenn ja), erstellt `RunningTimer`
- `stop(String description)`: erstellt `TimeEntry` via `RateResolverService`, löscht `RunningTimer`
- `discard()`: löscht `RunningTimer` ohne TimeEntry
- `update(TimerUpdateRequest)`: aktualisiert laufenden `RunningTimer`

### T2-5: TimerController
- `TimerController.java`: alle 5 Endpunkte
- DTOs: `TimerResponse.java`, `TimerStartRequest.java`, `TimerUpdateRequest.java`

### T2-6: TimeEntryService + Controller
- `TimeEntryService.java`: create, update, delete, findById, findAll (mit Filter), continue
- `TimeEntryController.java`
- DTOs: `TimeEntryRequest.java`, `TimeEntryResponse.java`, `TimeEntryFilter.java`

### T2-7: Timer-Bar Frontend
- `TimerBarComponent` in Topbar
- Polling `GET /timer/current` alle 5s (oder SSE wenn möglich)
- Start/Stop/Discard-Buttons
- Projekt/Task/Tags-Auswahl (Dropdowns mit Autocomplete)
- Billable-Toggle
- Laufende Zeit als `HH:MM:SS`-Display

### T2-8: Time Entries Liste + Dialoge Frontend
- `TimerPageComponent`: Route `/timer`
- Heutige Einträge als gruppierte Liste
- `TimeEntryRowComponent`: Beschreibung, Projekt, Dauer, Billable, Edit/Delete/Continue
- `TimeEntryFormDialogComponent`: Manueller Eintrag (Datum, Start, Ende, Projekt, Task, Tags)

---

## Phase 4 — Reports

### T4-1: ReportRepository
- `ReportRepository.java`: Native SQL Queries für alle Aggregationen
- `@Query` Annotationen mit Named-Params für Filter

### T4-2: ReportService
- `ReportService.java`
- `getSummary(ReportFilter)`, `getDetailed(ReportFilter, Pageable)`, `getBudgetReport()`, `getRevenue()`, `getTrends()`

### T4-3: ReportController
- `ReportController.java`: alle Report-Endpunkte

### T4-4: CSV-Export
- `CsvExportService.java`: nutzt Apache Commons CSV oder OpenCSV
- Header: Date, Client, Project, Task, Description, Start, End, Duration, Billable, Rate, Amount, Tags

### T4-5: Reports Frontend
- `ReportsComponent`: Route `/reports`
- `ReportFilterBarComponent`: Sticky Filterleiste (Zeitraum, Kunde, Projekt, Tag, Billable, Gruppierung)
- `SummaryCardsComponent`: Gesamtzeit, Billable, Umsatz
- `ReportChartComponent`: Bar-Chart (ECharts), Donut-Chart
- `ReportTableComponent`: Paginierte Detailtabelle

---

## Phase 5 — Dashboard + Heatmap

### T5-1: DashboardService + Controller
- `DashboardService.java`: aggregiert Today/Week/Month, Budget-Alerts, Top-Listen
- `DashboardController.java`: `GET /dashboard`

### T5-2: Dashboard Frontend
- `DashboardComponent`: Route `/dashboard`
- Stats-Cards mit Animation
- Budget-Progress-Bars mit Farbcodierung (grün/gelb/rot)
- Heatmap-Chart (ECharts Calendar Chart)
- Line-Chart: Wochentrend

---

## Test-Tickets (parallel zu Implementierung)

### TT-1: Timer Lifecycle Tests
- Unit: `TimerService` — start/stop/discard, 409 bei Doppelstart
- Integration: Testcontainers

### TT-2: Rate Resolution Tests
- Unit: `RateResolverService` mit allen 4 Fallback-Stufen

### TT-3: Budget Calculation Tests
- Unit: `ProjectService.getBudgetStatus()` inkl. monatlichem Reset

### TT-4: Report Query Tests
- Repository-Test: Filter, Gruppierung, Datumsgrenzen

### TT-5: API Controller Tests
- `@WebMvcTest` pro Controller
- Happy Path + Validierungsfehler + 404 + 409
