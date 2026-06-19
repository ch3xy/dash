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

## Phase 1 — Stammdaten (Clients, Projects, Tasks, Tags)

**Ziel:** Vollständiges CRUD für alle Stammdaten.

### Backend

- [ ] Flyway Migrationen V1–V5 + V10–V11 (Schema + Indexe)
- [ ] `Client` Entity, Repository, Service, Controller
- [ ] `Project` + `ProjectRate` Entity, Repository, Service, Controller
- [ ] `Task` Entity, Repository, Service, Controller
- [ ] `Tag` Entity, Repository, Service, Controller
- [ ] Archivierung-Logik (soft delete, kein Hard-Delete bei Abhängigkeiten)
- [ ] `AppSettings` Entity + Controller + Default-Werte via Flyway

### Frontend

- [ ] Clients-Seite: Liste + Formular (Anlegen/Bearbeiten)
- [ ] Projects-Seite: Liste mit Status-Badge, Budget-Balken
- [ ] Project-Detail: Tasks Tab + Rate-Historie Tab
- [ ] Tags-Verwaltung (minimal, in Settings oder eigenem Bereich)
- [ ] Archivierte Elemente aus Auswahlfeldern ausblenden

### Akzeptanzkriterien

- Kunde anlegen → Projekt zuordnen → Task anlegen: funktioniert end-to-end
- Archivierter Kunde verschwindet aus Projektformular
- Unique-Constraint auf Clientname meldet 409 mit ProblemDetail
- Projektbudget in Minuten und Stundensatz gespeichert

---

## Phase 2 — Time Tracking MVP

**Ziel:** Timer und manuelle Zeiterfassung vollständig funktionsfähig.

### Backend

- [ ] Flyway Migrationen V6–V8 (`time_entries`, `time_entry_tags`, `running_timers`)
- [ ] `TimeEntry` Entity, Repository, Service, Controller
- [ ] `RunningTimer` Entity, Repository, Service
- [ ] `TimerController`: `GET /timer/current`, `POST /timer/start`, `POST /timer/stop`, `POST /timer/discard`, `PATCH /timer/current`
- [ ] Rate-Snapshot-Berechnung beim Stoppen/Erstellen (s. [rules/business-rules.md](../rules/business-rules.md))
- [ ] `POST /time-entries/{id}/continue`
- [ ] Validierung: Endzeit > Startzeit, keine Überschneidung mit laufendem Timer, `durationSeconds > 0`
- [ ] Filter-Endpoint `GET /time-entries` mit allen Query-Params

### Frontend

- [ ] Timer-Bar in Topbar: Start/Stop, laufende Zeit, Projekt/Task/Tags, Billable-Toggle
- [ ] Timer-Polling (alle 5s oder SSE) für `elapsedSeconds`
- [ ] Heutige Zeiteinträge als Liste auf Timer-Seite
- [ ] Manueller Zeiteintrag Dialog (Datum, Start, Ende, Beschreibung, Projekt, Task, Tags)
- [ ] Continue-Button pro Eintrag
- [ ] Inline-Bearbeitung (Beschreibung, Projekt, Billable) in der Liste
- [ ] Löschen mit Bestätigung

### Akzeptanzkriterien

- Timer starten → Timer läuft → Timer stoppen → TimeEntry erscheint in Liste
- Zweiter Timer-Start bei laufendem Timer → `409 Conflict`, klare Fehlermeldung
- Manueller Eintrag mit falscher Dauer → Validierungsfehler
- `hourlyRateSnapshot` wird korrekt nach Priorität gesetzt (s. business-rules.md)
- Continue erstellt neuen Timer mit alten Metadaten

---

## Phase 3 — Timesheet & Kalender

**Ziel:** Schnelle Wocheneingabe und visuelle Darstellung.

### Backend

- [ ] `GET /reports/weekly` — Aggregation nach Woche
- [ ] Bulk-Upsert für Timesheet-Zellen (`POST /time-entries/bulk`)
- [ ] `GET /time-entries?from=&to=` für Kalender-Range

### Frontend

- [ ] Timesheet-Seite: Wochenraster (Projekte als Zeilen, Tage als Spalten)
- [ ] Inline-Zellbearbeitung (Dauer in HH:MM)
- [ ] Wochennavigation (Vor/Zurück)
- [ ] Tages- und Wochensummen
- [ ] Kalender-Seite: Tages-/Wochenansicht mit Zeiteinträgen als Blöcke

### Akzeptanzkriterien

- Woche lässt sich schnell nachtragen ohne Dialoge
- Kalendereinträge stimmen mit `time_entries` überein
- Tagesgesamt korrekt

---

## Phase 4 — Reports Basis

**Ziel:** Entscheidungsrelevante Reports.

### Backend

- [ ] `GET /reports/summary` mit Gruppierung
- [ ] `GET /reports/detailed` (paginiert)
- [ ] `GET /reports/budget`
- [ ] `GET /reports/revenue`
- [ ] `GET /reports/trends`
- [ ] `GET /reports/export.csv`
- [ ] Filter: Zeitraum, Kunde, Projekt, Task, Tag, Billable
- [ ] Gruppierung: Tag/Woche/Monat/Kunde/Projekt/Task

### Frontend

- [ ] Reports-Seite mit Filterbar (sticky)
- [ ] Summary-Cards (Gesamtzeit, Billable, Non-Billable, Umsatz)
- [ ] Bar-Chart: Stunden pro Projekt
- [ ] Donut-Chart: Billable vs Non-Billable
- [ ] Detailtabelle mit allen Einträgen
- [ ] CSV-Download-Button

### Akzeptanzkriterien

- Zeitraumfilter funktioniert korrekt
- Gruppierung nach Projekt/Kunde liefert konsistente Summen
- Budgetverbrauch sichtbar (usedPercent, Status-Indikator)
- CSV-Export öffnet sich korrekt

---

## Phase 5 — Erweiterte Reports & Visualisierung

**Ziel:** Vollständiges Reporting-System.

### Backend

- [ ] `GET /reports/heatmap`
- [ ] Rounded vs Raw Duration via `?rounded=true`
- [ ] `GET /reports/export.xlsx`
- [ ] `GET /dashboard` — aggregierte Dashboard-Daten

### Frontend

- [ ] Dashboard-Seite mit Today/Week/Month-Cards
- [ ] Heatmap-Visualisierung (ECharts)
- [ ] Line-Chart: Trendverlauf
- [ ] Budget-Progress-Bars auf Dashboard
- [ ] Top-Projekte und Top-Kunden
- [ ] XLSX-Export

### Akzeptanzkriterien

- Dashboard gibt sofortigen Überblick
- Heatmap zeigt Aktivitätsmuster
- Budget-Warnungen sichtbar bei >80%

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
