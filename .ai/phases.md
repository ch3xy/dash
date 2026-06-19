# Implementierungsphasen

Jede Phase baut auf der vorherigen auf. Innerhalb einer Phase sind die Tickets weitgehend unabhängig und können parallel implementiert werden.

---

## Phase 0 — Projekt-Setup ✅ 2026-06-19

**Ziel:** Lauffähiger Fullstack-Skeleton ohne Business-Logik.

### Backend

- [x] Spring Boot 4.1.0 Projekt, Java 25 Toolchain in `pom.xml`
- [x] `application.yml` Basis-Konfiguration (DB, Flyway, CORS)
- [x] Docker Compose mit PostgreSQL 17
- [x] Flyway V1–V4 (vollständiges Schema, Indexe, Constraints, Settings-Defaults)
- [x] RFC 7807 `ProblemDetail`-GlobalExceptionHandler (`@RestControllerAdvice`)
- [x] `GET /api/v1/health` → `{ "status": "UP", "timestamp": "..." }`
- [x] CORS für `http://localhost:4200`
- [x] Testcontainers Integration-Test für Context-Load

### Frontend

- [ ] Angular 22 Projekt — ausstehend (Backend-First-Strategie)

### Akzeptanzkriterien

- `docker compose up -d` → PostgreSQL erreichbar ✅
- `./mvnw spring-boot:run` → Backend startet, `/api/v1/health` antwortet ✅
- Tests: 1/1 grün ✅

---

## Phase 1 — Stammdaten (Clients, Projects, Tasks, Tags) ✅ 2026-06-19

**Ziel:** Vollständiges CRUD für alle Stammdaten.

### Backend

- [x] Schema bereits in Phase 0 via Flyway V1–V4 (alle Tabellen, Indexe, Constraints)
- [x] `Client` Entity, Repository, Service, Controller
- [x] `Project` + `ProjectRate` Entity, Repository, Service, Controller (inkl. Budget-Status, Rate-Historie)
- [x] `Task` Entity, Repository, Service, Controller
- [x] `Tag` Entity, Repository, Service, Controller
- [x] Archivierung-Logik (soft delete; Hard-Delete von Client via DB-FK → 409)
- [x] `AppSettings` Entity, Service (typed getters), Controller
- [x] `PageResponse<T>` Pagination-Helper (Vorbereitung Phase 2)
- [x] Budget-Status nutzt App-Zeitzone (`AppSettingsService.getTimezone()`)

### Frontend

- [ ] Angular-Seiten — ausstehend (Backend-First-Strategie, gesammelt nach Backend-Phasen)

### Akzeptanzkriterien

- Kunde anlegen → Projekt zuordnen → Task anlegen: funktioniert (Service-Integrationstests) ✅
- Unique-Constraint auf Clientname meldet 409 mit ProblemDetail ✅
- Projektbudget in Minuten und Stundensatz gespeichert ✅
- Neue Projekt-Rate schließt alte Rate historisch ab (Test) ✅
- Tests: 5/5 grün (Testcontainers, Singleton-Container) ✅

### Code-Review (medium)

- Behoben: `getBudgetStatus` verwendete JVM-Default-Zeitzone statt App-Zeitzone für MONTHLY/YEARLY-Grenzen.

---

## Phase 2 — Time Tracking MVP ✅ 2026-06-19

**Ziel:** Timer und manuelle Zeiterfassung vollständig funktionsfähig.

### Backend

- [x] Schema bereits in Phase 0 (`time_entries`, `time_entry_tags`, `running_timers`, `running_timer_tags`)
- [x] `TimeEntry` Entity (ManyToMany Tags), Repository (Filter-Query), Service, Controller
- [x] `RunningTimer` Entity (ManyToMany Tags), Repository, Service
- [x] `TimerController`: `current`, `start`, `stop`, `discard`, `PATCH current`
- [x] `RateResolverService`: Task-Override → aktive Project-Rate → Project-Default → App-Default
- [x] Rate- und Amount-Snapshot beim Erstellen/Stoppen (`BigDecimal`, HALF_UP)
- [x] `POST /time-entries/{id}/continue` → neuer Timer aus altem Eintrag
- [x] Validierung: Endzeit > Startzeit; max. 1 laufender Timer (409); `durationSeconds > 0`
- [x] Filter-Endpoint `GET /time-entries` (from/to/client/project/task/tag/billable/q + Pagination)
- [x] Testbare Zeit über injizierten `Clock` (`ClockConfig`)
- [x] `IllegalArgumentException` → 422 im GlobalExceptionHandler ergänzt

### Frontend

- [ ] Angular-Seiten — ausstehend (Backend-First-Strategie)

### Akzeptanzkriterien

- Timer starten → läuft → stoppen → TimeEntry erstellt (Test) ✅
- Zweiter Timer-Start bei laufendem Timer → `409 Conflict` (Test) ✅
- Manueller Eintrag mit Endzeit ≤ Startzeit → 422 (Test) ✅
- `hourlyRateSnapshot` korrekt nach Priorität, Snapshot stabil bei Ratenänderung (Tests) ✅
- Timer über Mitternacht: `entryDate` aus Endzeit in App-Zeitzone (Test) ✅
- Tests: 15/15 grün ✅

### Code-Review (medium)

- Keine Korrektheits-Bugs. N+1-Lazy-Loading der Tags in Listen-Query als bewusster
  MVP-Tradeoff akzeptiert (Performance-Tuning in Phase 4 Report-Modul).

---

## Phase 3 — Timesheet & Kalender ✅ 2026-06-19

**Ziel:** Schnelle Wocheneingabe und visuelle Darstellung.

### Backend

- [x] `GET /reports/weekly?weekStart=` — Mo–So Aggregation, Tages- und Wochensummen
- [x] Bulk-Erstellung für Timesheet-Zellen (`POST /time-entries/bulk`, transaktional all-or-nothing)
- [x] `GET /time-entries?from=&to=` für Kalender-Range (bereits aus Phase 2)
- [x] `findByEntryDateRange` mit Fetch-Join (Projekt/Client/Task), Tags lazy
- [x] Default-Woche nutzt App-Zeitzone (`ReportService.getWeekly(null)`)

### Frontend

- [ ] Angular-Seiten — ausstehend (Backend-First-Strategie)

### Akzeptanzkriterien

- Weekly-Report gruppiert Einträge nach Tag, liefert 7 Tage + Wochengesamt (Test) ✅
- Bulk-Endpoint legt mehrere Einträge in einer Transaktion an ✅
- Kalender-Range über bestehenden Filter-Endpoint ✅
- Tests: 16/16 grün ✅

### Code-Review (medium)

- Behoben: Default-Woche in `/reports/weekly` nutzte JVM-Default-Zeitzone statt App-Zeitzone
  (konsistent mit Phase-1-Fix). Explizite `weekStart`-Param bleibt unberührt.

---

## Phase 4 — Reports Basis ✅ 2026-06-19

**Ziel:** Entscheidungsrelevante Reports.

### Backend

- [x] `GET /reports/summary` mit Gruppierung (Totals, Billable-Ratio, Revenue je Gruppe)
- [x] `GET /reports/detailed` (paginiert, gleicher Filter)
- [x] `GET /reports/budget` (usedPercent, Status ON_TRACK/WARNING/EXCEEDED)
- [x] `GET /reports/revenue` (nach Revenue sortierte Gruppen, Default CLIENT)
- [x] `GET /reports/trends?granularity=DAY|WEEK|MONTH`
- [x] `GET /reports/export.csv` (Apache Commons CSV)
- [x] Filter: Zeitraum, Kunde, Projekt, Task, Tag, Billable, Volltext
- [x] Gruppierung: Tag/Woche/Monat/Kunde/Projekt/Task (whitelisted via `GroupBy`-Enum)
- [x] `ReportQueryRepository` mit nativen SQL-Aggregationen (NamedParameterJdbcTemplate)

### Frontend

- [ ] Angular-Seiten — ausstehend (Backend-First-Strategie)

### Akzeptanzkriterien

- Summary gruppiert nach Projekt, korrekte Billable-Ratio + Revenue (Test) ✅
- Budget-Report: 90% Auslastung → WARNING (Test) ✅
- Trends nach Tag mit Dauer + Revenue (Test) ✅
- CSV enthält Header + Zeilen mit Dauer/Betrag (Test) ✅
- Tests: 20/20 grün ✅

### Code-Review (medium)

- **Latenter Bug behoben:** `findWithFilter` (seit Phase 2) scheiterte auf PostgreSQL bei
  NULL-Filterwerten (`:param IS NULL` mit untypisiertem Bind). Auf natives SQL mit
  expliziten `CAST(... AS type)`-Guards umgestellt; Tag-Filter über `EXISTS` (kein `DISTINCT`).
- **Konsistenz:** `budget()`-Report nutzte SQL `CURRENT_DATE` (DB-Server-Zeitzone) für
  MONTHLY/YEARLY-Grenzen; jetzt App-Zeitzone (Monats-/Jahresstart als Bind-Param), konsistent
  mit Phase-1-`getBudgetStatus`.

---

## Phase 5 — Erweiterte Reports & Visualisierung ✅ 2026-06-19

**Ziel:** Vollständiges Reporting-System.

### Backend

- [x] `GET /reports/heatmap?year=` (Dauer je Tag + Intensität, App-Zeitzone für Default-Jahr)
- [x] Rounded vs Raw Duration via `?rounded=true` (Rundungsregel/-intervall aus Settings,
      whitelisted SQL-Expression UP/DOWN/NEAREST/NONE)
- [x] `GET /reports/export.xlsx` (Apache POI)
- [x] `GET /dashboard` — Today/Week/Month, laufender Timer, Budget-Alerts, Top-Projekte/-Kunden
- [x] `CsvExportService`/`XlsxExportService` teilen sich `ReportRowFetcher` + `ReportExportColumns`

### Frontend

- [ ] Angular-Seiten — ausstehend (Backend-First-Strategie)

### Akzeptanzkriterien

- Heatmap aggregiert pro Tag, 8h → Intensität 1.0 (Test) ✅
- Rounded-Summary rundet 50min auf 60min (15-min UP) (Test) ✅
- XLSX-Export erzeugt gültige Workbook-Bytes (Test) ✅
- Dashboard liefert Perioden-Stats, kein Timer wenn keiner läuft (Test) ✅
- Tests: 24/24 grün ✅

### Code-Review (medium)

- **Bug behoben:** `DashboardService` rief `timerService.getCurrent()`, das bei fehlendem Timer
  `EntityNotFoundException` warf und die gemeinsame Transaktion als rollback-only markierte
  (→ `UnexpectedRollbackException` beim Commit, trotz catch). Neue nicht-werfende
  `TimerService.findCurrent()` (Optional) ersetzt den try/catch.

---

## Phase 6 — Polishing & Produktivität

**Ziel:** Reibungsloser täglicher Workflow.

- [ ] Tastatur-Shortcuts: `n` neuer Eintrag, `t` Timer, `s` Start/Stop, `/` Suche
- [ ] Schneller Projektwechsel in Timer-Bar
- [ ] Zuletzt verwendete Projekt/Task-Kombination
- [ ] Dark/Light Mode vollständig
- [ ] Import Clockify CSV
- [ ] Backup/Restore (alle Daten als JSON-Export/Import)
- [ ] Inline-Editing in Detailliste

---

## Phase 7 — Optionale Zukunftsfeatures

Nicht im MVP-Scope:

- Invoicing
- Expenses
- Desktop-App (Tauri)
- Mobile PWA
- Auth / Multi-User
- Forecasting / Projektplanung
