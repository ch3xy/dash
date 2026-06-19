# CLAUDE.md — Time Tracking App / Clockify Replacement

> Ziel: Eine lokale, moderne Einzelbenutzer-App bauen, die Clockify für persönliche Zeiterfassung, Kunden-/Projektmanagement, Budgets, Stundensätze, Reports und Visualisierungen vollständig ablöst, ohne im ersten Schritt Team-, Rollen- oder Security-Komplexität einzuführen.

---

## Implementierungsreferenz — `.ai/`

Alle maschinenlesbaren Implementierungsdetails befinden sich im `.ai/`-Verzeichnis:

| Datei | Inhalt |
|---|---|
| [.ai/README.md](.ai/README.md) | Index aller `.ai`-Dateien |
| [.ai/stack.md](.ai/stack.md) | Tech-Stack, Versionen, Konfiguration |
| [.ai/datamodel.md](.ai/datamodel.md) | PostgreSQL-Schema, DDL, Flyway-Migrationen |
| [.ai/api.md](.ai/api.md) | Vollständige REST-API-Spezifikation |
| [.ai/phases.md](.ai/phases.md) | Implementierungsphasen mit Akzeptanzkriterien |
| [.ai/tickets.md](.ai/tickets.md) | Priorisierte Tickets pro Phase |
| [.ai/rules/business-rules.md](.ai/rules/business-rules.md) | Raten, Budget, Timer-Lifecycle, Rundung |
| [.ai/rules/coding-standards.md](.ai/rules/coding-standards.md) | Backend- und Frontend-Coding-Richtlinien |
| [.ai/modules/client.md](.ai/modules/client.md) | Client-Modul |
| [.ai/modules/project.md](.ai/modules/project.md) | Project + Rate + Budget |
| [.ai/modules/task.md](.ai/modules/task.md) | Task-Modul |
| [.ai/modules/tag.md](.ai/modules/tag.md) | Tag-Modul |
| [.ai/modules/timeentry.md](.ai/modules/timeentry.md) | TimeEntry-Modul (Kern) |
| [.ai/modules/timer.md](.ai/modules/timer.md) | RunningTimer-Modul |
| [.ai/modules/report.md](.ai/modules/report.md) | Report-Modul inkl. Export |
| [.ai/modules/dashboard.md](.ai/modules/dashboard.md) | Dashboard-Modul |
| [.ai/modules/settings.md](.ai/modules/settings.md) | AppSettings-Modul |
| [.ai/frontend/architecture.md](.ai/frontend/architecture.md) | Angular-Struktur, Routing, State |
| [.ai/frontend/design-system.md](.ai/frontend/design-system.md) | Design-System, Komponenten, Charts |

**Für autonome Implementierung:** Starte mit [.ai/phases.md](.ai/phases.md) und [.ai/tickets.md](.ai/tickets.md). Modul-Details in `modules/`, Business-Regeln in `rules/`.

---

## 1. Projektkontext

Diese Anwendung ist ein Clockify-ähnlicher Time-Tracking- und Reporting-Stack für eine einzelne Person im lokalen Netzwerk.

### Primäre Ziele

- Schnelle, zuverlässige Zeiterfassung per Timer und manueller Eingabe.
- Kunden- und Projektverwaltung mit aktiven/inaktiven Zuständen.
- Pro Projekt definierbare verfügbare Stunden, Stundensatz, Budget-Status und optionaler Geldbetrag.
- Ausführliche Reports mit Filterung, Gruppierung, Export und Visualisierungen.
- Modernes, klares UI nach aktuellen UX-/Design-Richtlinien.
- Lokaler Betrieb ohne Login/Security im ersten Schritt.
- Architektur so vorbereiten, dass Security, Multi-User oder Team-Funktionen später ergänzt werden könnten, ohne das Kernmodell neu zu schreiben.

### Explizit nicht im MVP

- Kein Login, keine Authentifizierung, keine Rollenverwaltung.
- Keine Team-/User-Verwaltung.
- Keine Cloud-Synchronisation.
- Keine Mobile-App im ersten Schritt.
- Keine direkte 1:1-Kopie von Clockify-Branding, Logos, Texten oder geschütztem UI-Design.

---

## 2. Referenz-Featurebereiche aus Clockify

Die App soll funktional an Clockify angelehnt sein. Wichtig sind insbesondere:

- Timer: Start/Stop, laufender Timer, Fortsetzen eines alten Eintrags.
- Manuelle Zeiteinträge: Start/Ende, Dauer, Datum, Beschreibung.
- Billable Flag: abrechenbar/nicht abrechenbar.
- Timesheet-Ansicht: Tages-/Wochenansicht zur schnellen Eingabe.
- Kalender-/Timeline-Ansicht: visuelle Darstellung der Zeiteinträge.
- Kunden, Projekte, Tasks/Aktivitäten.
- Tags und optionale Custom Fields.
- Projektbudgets: Stundenbudget und optional Geldbudget.
- Stundensätze: Projekt-, Task- und historische Raten.
- Reports: Summary, Detailed, Weekly, Budget, Revenue, Utilization, Trends.
- Exporte: CSV, Excel-kompatibel, PDF optional.
- Dashboard: Heute, diese Woche, laufende Projekte, Budgetverbrauch, Umsatz, Top-Kunden.

Da die Anwendung nur für eine Person ist, werden teambezogene Clockify-Features zunächst ersetzt durch einfache Einzelbenutzer-Äquivalente:

| Clockify-Konzept | Einzelbenutzer-Äquivalent |
|---|---|
| Workspace | Lokale Instanz / App-Konfiguration |
| User / Member | Impliziter lokaler Benutzer |
| Team Rates | Nicht nötig |
| Approval | Nicht nötig |
| Attendance | Optional als Tagesstart-/Ende-Report |
| Manager Permissions | Nicht nötig |
| Scheduling | Später optional als Projektplanung |
| Invoicing | Später optional, aber Datenmodell vorbereiten |

---

## 3. Empfohlener Tech Stack

### Backend

- Java 25
- Spring Boot 4.x
- Spring Framework 7.x
- Spring Web MVC oder WebFlux: Empfehlung für MVP ist Web MVC
- Spring Data JPA + Hibernate
- Flyway für Datenbankmigrationen
- PostgreSQL 17+ oder aktuelle stabile PostgreSQL-Version
- Jackson 3, wie in Spring Boot 4 standardmäßig vorgesehen
- Bean Validation / Jakarta Validation
- Testcontainers für Integrationstests
- JUnit 5, AssertJ, Mockito
- MapStruct für DTO-Mapping optional, alternativ manuelles Mapping
- springdoc-openapi, sobald Spring Boot 4 kompatibel sauber verfügbar ist; sonst OpenAPI-YAML manuell pflegen

### Frontend

- Angular 22
- Node.js 24 LTS als Standard für stabile Entwicklung
- Node.js 26 Current nur, wenn Angular-/Tooling-Kompatibilität bestätigt ist
- TypeScript 6.x gemäß Angular-Kompatibilität
- Angular standalone components
- Angular signals für lokalen UI-State
- Angular Router
- Reactive Forms
- Angular Material oder PrimeNG als UI-Basis
- ECharts, Apache Superset Embedded optional oder ngx-charts für Visualisierung
- TanStack Table/Angular-kompatible Table-Lösung oder Angular CDK Table für Reports

### Infrastruktur lokal

- Docker Compose für PostgreSQL und optional Backend/Frontend
- Lokale `.env`-Dateien
- Kein Kubernetes im ersten Schritt
- Makefile oder Taskfile für Entwicklerkommandos

---

## 4. Architekturprinzipien

1. **Modularer Monolith statt Microservices**  
   Für eine Einzelbenutzer-App ist ein modularer Monolith schneller, robuster und wartbarer.

2. **Domain-first statt CRUD-only**  
   Zeiteinträge, Projektbudgets, Ratenhistorie und Reports enthalten Business-Regeln. Diese gehören in Services/Domain-Logik, nicht nur in Controller.

3. **Reporting als eigener Bereich**  
   Reporting sollte eigene Query-Modelle, Aggregationsservices und ggf. SQL-Views bekommen. Nicht jede Reportabfrage über JPA-Entity-Graphen lösen.

4. **Keine Security jetzt, aber Security-fähige Schnittstellen**  
   Keine Auth im MVP, aber Controller und Services nicht hart auf globale Zustände verdrahten. Später kann ein `OwnerContext` oder `WorkspaceContext` eingeführt werden.

5. **Zeit immer explizit modellieren**  
   Intern mit `Instant` für Zeitpunkte, `LocalDate` für Berichtstage, `Duration`/Sekunden für Dauer. Zeitzone als App-Konfiguration speichern, Default: `Europe/Vienna`.

6. **Geld als Decimal, nie Floating Point**  
   Stundensatz und Umsatz mit `BigDecimal`, Währung als ISO-Code, Default z. B. `EUR`.

7. **Reports reproduzierbar machen**  
   Alte Zeiteinträge sollen historische Stundensätze behalten. Wenn sich ein Projektsatz ändert, sollen alte Reports stabil bleiben.

---

## 5. Zielarchitektur

```text
repo/
  backend/
    src/main/java/.../timetracker/
      app/
        ClockifyReplacementApplication.java
      common/
        error/
        time/
        money/
        pagination/
      client/
        ClientController.java
        ClientService.java
        ClientRepository.java
        Client.java
      project/
        ProjectController.java
        ProjectService.java
        ProjectRepository.java
        Project.java
        ProjectRate.java
        ProjectBudget.java
      task/
        TaskController.java
        TaskService.java
        Task.java
      tag/
        TagController.java
        TagService.java
        Tag.java
      timeentry/
        TimeEntryController.java
        TimeEntryService.java
        TimerService.java
        TimeEntry.java
        RunningTimer.java
      report/
        ReportController.java
        ReportService.java
        ReportRepository.java
        dto/
      dashboard/
        DashboardController.java
        DashboardService.java
      export/
        ExportController.java
        CsvExportService.java
        PdfExportService.java
      settings/
        AppSettingsController.java
        AppSettingsService.java
    src/main/resources/
      db/migration/
      application.yml
  frontend/
    src/app/
      core/
        api/
        layout/
        error/
      shared/
        components/
        pipes/
        utils/
      features/
        dashboard/
        timer/
        timesheet/
        calendar/
        clients/
        projects/
        tasks/
        tags/
        reports/
        settings/
  docker-compose.yml
  README.md
  CLAUDE.md
```

---

## 6. Backend Module

### 6.1 `client`

Verwaltet Kunden.

Felder:

- `id`
- `name`
- `description`
- `email` optional
- `website` optional
- `currencyCode` optional, Default aus Settings
- `archived`
- `createdAt`
- `updatedAt`

Regeln:

- Kundenname eindeutig, solange nicht archiviert.
- Kunden können archiviert, aber nicht hart gelöscht werden, solange Projekte existieren.

### 6.2 `project`

Verwaltet Projekte, Budgets und Raten.

Felder `Project`:

- `id`
- `clientId`
- `name`
- `description`
- `color`
- `status`: `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED`
- `billableByDefault`
- `defaultHourlyRate`
- `currencyCode`
- `hourBudgetMinutes`
- `moneyBudgetAmount` optional
- `budgetReset`: `NONE`, `MONTHLY`, `YEARLY` optional
- `createdAt`
- `updatedAt`

Felder `ProjectRate`:

- `id`
- `projectId`
- `hourlyRate`
- `currencyCode`
- `validFrom`
- `validTo` nullable
- `note`

Regeln:

- Neue Stundensätze schließen alte Rate historisch ab.
- Ein TimeEntry speichert zusätzlich den angewendeten Satz als Snapshot.
- Projektbudget wird in Minuten gespeichert.

### 6.3 `task`

Tasks/Aktivitäten innerhalb von Projekten.

Felder:

- `id`
- `projectId`
- `name`
- `description`
- `billableByDefault`
- `hourlyRateOverride` optional
- `estimatedMinutes` optional
- `archived`

Regeln:

- Taskname eindeutig je Projekt.
- Taskrate überschreibt Projektrate, falls gesetzt.

### 6.4 `tag`

Flexible Kategorisierung.

Felder:

- `id`
- `name`
- `color`
- `archived`

### 6.5 `timeentry`

Kern der Anwendung.

Felder `TimeEntry`:

- `id`
- `projectId`
- `taskId` optional
- `description`
- `startTime` als `Instant`
- `endTime` als `Instant`
- `durationSeconds`
- `entryDate` als `LocalDate` in App-Zeitzone
- `billable`
- `hourlyRateSnapshot`
- `currencyCodeSnapshot`
- `amountSnapshot`
- `source`: `TIMER`, `MANUAL`, `IMPORT`, `ADJUSTMENT`
- `createdAt`
- `updatedAt`

Felder `RunningTimer`:

- `id`
- `projectId`
- `taskId` optional
- `description`
- `startTime`
- `billable`
- `createdAt`

Regeln:

- Maximal ein laufender Timer.
- Start eines neuen Timers stoppt entweder den alten Timer automatisch oder wird abgelehnt. Empfehlung: ablehnen und UI auffordern, den bestehenden Timer zu stoppen.
- Manuelle Einträge dürfen sich über Mitternacht erstrecken, werden aber in Reports nach `entryDate` oder optional gesplittet ausgewertet.
- Negative oder null Dauer ist verboten.
- Endzeit muss nach Startzeit liegen.
- Laufender Timer wird nicht als endgültiger TimeEntry gespeichert, bis er gestoppt wird.

### 6.6 `report`

Eigene Services und Repositories für Aggregationen.

Reporttypen:

- Summary Report
- Detailed Report
- Weekly Timesheet Report
- Project Budget Report
- Client Revenue Report
- Billable vs Non-Billable Report
- Trend Report
- Calendar Heatmap Report
- Rate/Revenue Audit Report

Filter:

- Zeitraum
- Kunde
- Projekt
- Task
- Tag
- Billable
- Status
- Beschreibungssuche
- Gruppierung nach Tag/Tag der Woche/Woche/Monat/Kunde/Projekt/Task

Metriken:

- Total duration
- Billable duration
- Non-billable duration
- Billable ratio
- Revenue
- Budget used percent
- Budget remaining hours
- Average daily hours
- Top projects
- Top clients
- Daily/weekly/monthly trend

---

## 7. Datenmodell PostgreSQL

```sql
clients
  id uuid pk
  name text not null
  description text
  email text
  website text
  currency_code varchar(3)
  archived boolean not null default false
  created_at timestamptz not null
  updated_at timestamptz not null

projects
  id uuid pk
  client_id uuid references clients(id)
  name text not null
  description text
  color text
  status text not null
  billable_by_default boolean not null default true
  default_hourly_rate numeric(12,2)
  currency_code varchar(3) not null
  hour_budget_minutes integer
  money_budget_amount numeric(12,2)
  budget_reset text not null default 'NONE'
  created_at timestamptz not null
  updated_at timestamptz not null

tasks
  id uuid pk
  project_id uuid not null references projects(id)
  name text not null
  description text
  billable_by_default boolean not null default true
  hourly_rate_override numeric(12,2)
  estimated_minutes integer
  archived boolean not null default false
  created_at timestamptz not null
  updated_at timestamptz not null

tags
  id uuid pk
  name text not null unique
  color text
  archived boolean not null default false
  created_at timestamptz not null
  updated_at timestamptz not null

time_entries
  id uuid pk
  project_id uuid not null references projects(id)
  task_id uuid references tasks(id)
  description text
  start_time timestamptz not null
  end_time timestamptz not null
  duration_seconds integer not null
  entry_date date not null
  billable boolean not null
  hourly_rate_snapshot numeric(12,2)
  currency_code_snapshot varchar(3)
  amount_snapshot numeric(12,2)
  source text not null
  created_at timestamptz not null
  updated_at timestamptz not null

time_entry_tags
  time_entry_id uuid not null references time_entries(id) on delete cascade
  tag_id uuid not null references tags(id)
  primary key(time_entry_id, tag_id)

running_timers
  id uuid pk
  project_id uuid not null references projects(id)
  task_id uuid references tasks(id)
  description text
  start_time timestamptz not null
  billable boolean not null
  created_at timestamptz not null

project_rates
  id uuid pk
  project_id uuid not null references projects(id)
  hourly_rate numeric(12,2) not null
  currency_code varchar(3) not null
  valid_from timestamptz not null
  valid_to timestamptz
  note text

app_settings
  key text pk
  value text not null
```

Empfohlene Indexe:

```sql
create index idx_time_entries_entry_date on time_entries(entry_date);
create index idx_time_entries_project_date on time_entries(project_id, entry_date);
create index idx_time_entries_task_date on time_entries(task_id, entry_date);
create index idx_time_entries_billable_date on time_entries(billable, entry_date);
create index idx_projects_client on projects(client_id);
create unique index ux_active_client_name on clients(lower(name)) where archived = false;
create unique index ux_project_name_per_client on projects(client_id, lower(name));
create unique index ux_task_name_per_project on tasks(project_id, lower(name));
```

---

## 8. REST API Entwurf

Base path: `/api/v1`

### Clients

```http
GET    /clients
POST   /clients
GET    /clients/{id}
PUT    /clients/{id}
PATCH  /clients/{id}/archive
DELETE /clients/{id}
```

### Projects

```http
GET    /projects
POST   /projects
GET    /projects/{id}
PUT    /projects/{id}
PATCH  /projects/{id}/archive
GET    /projects/{id}/budget-status
GET    /projects/{id}/rates
POST   /projects/{id}/rates
```

### Tasks

```http
GET    /projects/{projectId}/tasks
POST   /projects/{projectId}/tasks
PUT    /tasks/{id}
PATCH  /tasks/{id}/archive
```

### Time Entries

```http
GET    /time-entries?from=&to=&clientId=&projectId=&taskId=&billable=&tagId=&q=
POST   /time-entries
GET    /time-entries/{id}
PUT    /time-entries/{id}
DELETE /time-entries/{id}
POST   /time-entries/{id}/continue
```

### Timer

```http
GET    /timer/current
POST   /timer/start
POST   /timer/stop
POST   /timer/discard
PATCH  /timer/current
```

### Reports

```http
GET /reports/summary
GET /reports/detailed
GET /reports/weekly
GET /reports/budget
GET /reports/revenue
GET /reports/trends
GET /reports/heatmap
GET /reports/export.csv
GET /reports/export.xlsx
```

---

## 9. Frontend Architektur

### Layout

- App Shell mit Sidebar, Topbar und Content-Bereich.
- Persistent Timer in Topbar oder Bottom Bar.
- Responsive Desktop-first Design, aber Tablet-tauglich.
- Dark/Light Mode.
- Schnellsuche und Quick Actions.

### Hauptseiten

1. **Dashboard**
   - Laufender Timer
   - Heute getrackte Zeit
   - Woche/Monat Zusammenfassung
   - Budget-Warnungen
   - Umsatz-Vorschau
   - Top Projekte/Kunden

2. **Timer / Time Tracker**
   - Start/Stop Timer
   - Beschreibung
   - Projekt/Task/Tags
   - Billable Toggle
   - Liste heutiger Einträge
   - Continue-Button

3. **Timesheet**
   - Wochenraster
   - Projekte/Tasks als Zeilen, Tage als Spalten
   - Schnelle manuelle Eingabe
   - Wochen-Totals

4. **Calendar**
   - Tages-/Wochenkalender
   - Drag/Resize optional später
   - Visuelle Lücken und Überschneidungen

5. **Clients**
   - Liste, Detail, Projekte je Kunde

6. **Projects**
   - Projektliste mit Status, Kunde, Budgetverbrauch, Rate
   - Projekt-Detailseite
   - Tasks
   - Ratenhistorie
   - Budget-Status

7. **Reports**
   - Summary Cards
   - Filter Panel
   - Gruppierung
   - Charts
   - Details Table
   - Export Buttons

8. **Settings**
   - Zeitzone
   - Standard-Währung
   - Rundungsregeln
   - Standard-Stundensatz
   - Datensicherung/Import/Export

### Frontend State

- Server-State über Services + Angular Signals oder RxJS.
- Kein globales Heavy-State-Framework im MVP nötig.
- Lokaler UI-State in Components.
- Filterzustände in URL Query Params speichern.

---

## 10. Design-System

### Ziele

- Modern, ruhig, produktivitätsorientiert.
- Hohe Informationsdichte ohne überladen zu wirken.
- Gute Lesbarkeit für lange Reports.
- Schnelle Dateneingabe mit Tastaturunterstützung.

### Richtlinien

- 8px spacing system.
- Klare Card-Komponenten.
- Sticky Filterbar in Reports.
- Tabellen mit Column Resize, Sortierung und gespeicherten Ansichten später.
- Farbcodierte Projekte.
- Subtile Statusindikatoren:
  - Grün: im Budget
  - Gelb: >80% Budget
  - Rot: überschritten
  - Grau: archiviert/inaktiv
- Dashboard-Charts nicht dekorativ, sondern entscheidungsorientiert.
- Tastatur-Shortcuts:
  - `n`: neuer Zeiteintrag
  - `t`: Timer fokussieren
  - `s`: Timer starten/stoppen
  - `/`: Suche

### Visualisierungen

- Line Chart: Zeit pro Tag/Woche/Monat.
- Bar Chart: Stunden pro Projekt/Kunde.
- Donut Chart: Billable vs Non-Billable.
- Heatmap: Aktivität über Tage.
- Progress Bars: Projektbudgets.
- Table + Pivot-artige Gruppierung für detaillierte Reports.

---

## 11. Business-Regeln

### Ratenberechnung

1. Task Rate, falls vorhanden.
2. Sonst aktive Project Rate zum Startzeitpunkt.
3. Sonst Project Default Rate.
4. Sonst App Default Rate.
5. Snapshot auf TimeEntry speichern.

### Umsatzberechnung

```text
amount = durationHours * hourlyRateSnapshot
```

- Dauer intern Sekunden.
- Für Anzeige gerundet.
- Für Abrechnung optional Rundungsregel anwenden.

### Budgetverbrauch

```text
usedMinutes = sum(durationSeconds) / 60
remainingMinutes = project.hourBudgetMinutes - usedMinutes
usedPercent = usedMinutes / hourBudgetMinutes * 100
```

Bei monatlichem Reset:

- Nur Einträge im aktuellen Monat zählen.

### Rundung

App-Setting:

- Keine Rundung
- Auf nächste 5/10/15/30 Minuten aufrunden
- Zur nächsten 5/10/15 Minuten runden
- Abrunden

Wichtig: Rohdauer bleibt unverändert. Reports können raw oder rounded auswerten.

---

## 12. Implementierungsplan

### Phase 0 — Projektsetup

Ziel: Lauffähiger Fullstack-Skeleton.

Backend:

- Spring Boot 4 Projekt erzeugen.
- Java 25 Toolchain konfigurieren.
- PostgreSQL via Docker Compose.
- Flyway einrichten.
- Basis-Error-Handling mit RFC7807 Problem Details.
- Health Endpoint.
- CORS für lokales Frontend.

Frontend:

- Angular 22 Projekt erzeugen.
- Node 24 LTS verwenden.
- Routing, Layout, Theme, ESLint/Prettier.
- API Client Services.

Akzeptanzkriterien:

- `docker compose up` startet PostgreSQL.
- Backend startet und verbindet sich mit DB.
- Frontend zeigt App Shell.
- `/api/v1/health` funktioniert.

### Phase 1 — Kunden & Projekte

Ziel: Basisdaten erfassen.

Backend:

- Client CRUD.
- Project CRUD.
- Task CRUD.
- Tags CRUD.
- Archivieren statt hart löschen.
- Flyway Migrationen.

Frontend:

- Clients Page.
- Projects Page.
- Project Detail mit Tasks und Rate/Budget-Feldern.
- Basic Form Validation.

Akzeptanzkriterien:

- Kunde anlegen, Projekt zuordnen, Task anlegen.
- Projekt hat Stundenbudget und Stundensatz.
- Archivierte Elemente verschwinden standardmäßig aus Auswahlfeldern.

### Phase 2 — Time Tracking MVP

Ziel: Clockify-Kern ersetzen.

Backend:

- TimeEntry CRUD.
- Timer starten/stoppen/discard/update.
- Continue TimeEntry.
- Rate Snapshot beim Erstellen/Stoppen.
- Validierungen.

Frontend:

- Timer-Bar.
- Heute-Liste.
- Manueller Zeiteintrag Dialog.
- Continue Button.
- Billable Toggle.
- Projekt/Task/Tag Auswahl.

Akzeptanzkriterien:

- Timer starten und stoppen erzeugt Eintrag.
- Manuelle Einträge funktionieren.
- Einträge können editiert und gelöscht werden.
- Umsatz und Dauer werden korrekt berechnet.

### Phase 3 — Timesheet & Kalender

Ziel: Schnelle wöchentliche Eingabe und visuelle Prüfung.

Backend:

- Weekly aggregation endpoint.
- Bulk upsert für Timesheet-Zellen.
- Calendar endpoint für Zeitraum.

Frontend:

- Wochenraster.
- Schnelle Zellbearbeitung.
- Tages-/Wochenkalender.
- Tagesgesamt und Wochengesamt.

Akzeptanzkriterien:

- Woche lässt sich schnell nachtragen.
- Kalendereinträge stimmen mit TimeEntries überein.

### Phase 4 — Reports Basis

Ziel: Reports als Entscheidungssystem.

Backend:

- Summary Report.
- Detailed Report.
- Revenue Report.
- Budget Report.
- Filter- und Gruppierungslogik.
- CSV Export.

Frontend:

- Report Filterbar.
- Summary Cards.
- Detaillierte Tabelle.
- Charts für Projekt/Kunde/Billable/Trend.
- CSV Download.

Akzeptanzkriterien:

- Zeitraumfilter funktioniert.
- Gruppierung nach Kunde/Projekt/Task/Tag funktioniert.
- Projektbudgetverbrauch ist sichtbar.
- Umsatz pro Kunde/Projekt wird angezeigt.

### Phase 5 — Erweiterte Reports & Visualisierung

Ziel: Clockify-Reporting weitgehend ersetzen.

Backend:

- Heatmap Daten.
- Trenddaten täglich/wöchentlich/monatlich.
- Rounded vs Raw Duration.
- Export XLSX.
- Optional PDF Export.

Frontend:

- Heatmap.
- Pivot-artige Gruppierung.
- Gespeicherte Report-Views optional.
- Drilldown von Chart zu Detailtabelle.

Akzeptanzkriterien:

- Reports beantworten: Wofür ging meine Zeit drauf? Was ist abrechenbar? Welche Projekte laufen über Budget? Welcher Kunde bringt wie viel Umsatz?

### Phase 6 — Polishing & Produktivität

Ziel: App fühlt sich besser als Clockify für persönlichen Workflow an.

- Tastatur-Shortcuts.
- Schneller Projektwechsel.
- Zuletzt verwendete Kombinationen.
- Inline Editing.
- Dark Mode.
- Backup/Restore.
- Import von Clockify CSV.
- Export aller Daten.

Akzeptanzkriterien:

- Regelmäßige Nutzung ohne Reibung.
- Import vorhandener Clockify-Daten möglich.
- Vollständiges lokales Backup möglich.

### Phase 7 — Optionale Zukunftsfeatures

- Invoicing.
- Expenses.
- Forecasting.
- Projektplanung/Scheduling.
- Desktop-App via Tauri.
- Browser Extension.
- Mobile PWA.
- Auth für Zugriff außerhalb des lokalen Netzwerks.
- Multi-User/Team-Modul.

---

## 13. Teststrategie

### Backend

- Unit Tests für Business-Regeln:
  - Timer Lifecycle
  - Rate Resolution
  - Budget Calculation
  - Rounding
- Integration Tests mit Testcontainers PostgreSQL.
- Repository Tests für Report Queries.
- API Tests für Controller.

### Frontend

- Component Tests für Forms.
- Service Tests für API Mapping.
- E2E Tests mit Playwright:
  - Projekt anlegen
  - Timer starten/stoppen
  - Report prüfen

### Kritische Testfälle

- Timer läuft über Mitternacht.
- Projektstundensatz wird geändert, alter TimeEntry bleibt stabil.
- Budget überschritten.
- Nicht abrechenbarer Eintrag erzeugt keinen Umsatz.
- Archiviertes Projekt bleibt in alten Reports sichtbar.
- Manuelle Einträge mit ungültiger Dauer werden abgelehnt.

---

## 14. Lokale Entwicklung

### Docker Compose

```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: timetracker
      POSTGRES_USER: timetracker
      POSTGRES_PASSWORD: timetracker
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

### Backend Start

```bash
cd backend
./gradlew bootRun
```

### Frontend Start

```bash
cd frontend
npm install
npm start
```

---

## 15. Coding Guidelines für Claude

Beim Arbeiten an diesem Projekt bitte folgende Regeln beachten:

1. Schreibe zuerst kleine, gut testbare Änderungen.
2. Keine Team-/Security-Features implementieren, solange nicht explizit angefordert.
3. Keine Clockify-Assets, Logos oder geschützte Texte kopieren.
4. Domain-Regeln nicht im Frontend verstecken; Backend ist Source of Truth.
5. Reports performancebewusst bauen: SQL-Aggregation ist erlaubt und oft bevorzugt.
6. Jede neue Datenstruktur braucht Flyway Migration.
7. Geldwerte immer `BigDecimal`/`numeric`, nie `double`/`float`.
8. Zeitpunkte immer sauber mit Zeitzone behandeln.
9. API-DTOs nicht direkt als JPA Entities exposen.
10. Beim Refactoring erst Tests schreiben oder vorhandene Tests erweitern.
11. UI soll keyboard-friendly und schnell bleiben.
12. Feature-Parität mit Clockify ist Ziel, aber Einzelbenutzer-Scope hat Vorrang.

---

## 16. Erste konkrete Tickets

### Ticket 1: Repository Bootstrap

- Monorepo mit `backend`, `frontend`, `docker-compose.yml`.
- Backend Spring Boot 4 + Java 25.
- Frontend Angular 22 + Node 24 LTS.
- PostgreSQL Compose Setup.
- README mit Startanleitung.

### Ticket 2: Datenbankbasis

- Flyway einrichten.
- Tabellen für clients, projects, tasks, tags, time_entries, time_entry_tags, running_timers, project_rates, app_settings.
- Indexe und Constraints.

### Ticket 3: Client/Project CRUD

- REST Controller.
- Service Layer.
- Repository Layer.
- DTOs.
- Frontend Listen und Formulare.

### Ticket 4: Timer MVP

- Current Timer endpoint.
- Start/Stop/Discard.
- Timer Bar im Frontend.
- TimeEntry Erstellung beim Stoppen.

### Ticket 5: Reports MVP

- Summary Report endpoint.
- Detailed Report endpoint.
- Frontend Reports Page.
- CSV Export.

---

## 17. Definition of Done

Ein Feature ist fertig, wenn:

- Backend validiert Eingaben.
- Fehler werden verständlich als Problem Details zurückgegeben.
- Datenbankmigration ist vorhanden.
- Tests für Kernlogik existieren.
- Frontend zeigt Lade-, Fehler- und Leerzustände.
- UI ist responsive genug für Desktop und Tablet.
- Keine toten Endpunkte oder ungenutzten DTOs entstehen.
- Dokumentation in README/CLAUDE.md aktualisiert wurde, falls relevant.

---

## 18. Offene Architekturentscheidungen

Diese Punkte sollten vor oder während Phase 2 entschieden werden:

1. Soll ein laufender Timer beim Start eines neuen Timers automatisch gestoppt werden?
   - Empfehlung: Nein, explizit stoppen lassen.

2. Sollen Einträge über Mitternacht automatisch gesplittet werden?
   - Empfehlung: Intern nicht splitten, Reports können optional nach Tagen splitten.

3. Soll Budgetverbrauch raw oder gerundet berechnet werden?
   - Empfehlung: Raw als Standard, rounded nur für abrechnungsnahe Reports.

4. Soll Task als Pflichtfeld gelten?
   - Empfehlung: Nein, Projekt reicht.

5. Soll Import aus Clockify CSV früh kommen?
   - Empfehlung: Nach Phase 4, wenn Kernmodell stabil ist.

---

## 19. Quellen / Stand

Stand: 2026-06-19

- Spring Boot 4 Release Highlights: https://spring.io/projects/release-highlights/
- Angular Version Compatibility: https://angular.dev/reference/versions
- Node.js Downloads: https://nodejs.org/en/download
- Clockify Features: https://clockify.me/features/
- Clockify Rates: https://clockify.me/features/rates
- Clockify Pricing / Feature Matrix: https://clockify.me/pricing
