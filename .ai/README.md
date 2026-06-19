# .ai — Implementation Reference

Dieses Verzeichnis enthält alle maschinenlesbaren Implementierungsdetails für eine autonome Umsetzung des Projekts. Das übergeordnete CLAUDE.md referenziert auf diese Dateien.

## Dateiübersicht

| Datei | Inhalt |
|---|---|
| [stack.md](stack.md) | Tech-Stack mit genauen Versionen und Konfiguration |
| [datamodel.md](datamodel.md) | PostgreSQL-Schema, DDL, Constraints, Indexe |
| [api.md](api.md) | Vollständige REST-API-Spezifikation inkl. Request/Response-Shapes |
| [phases.md](phases.md) | Implementierungsphasen mit Akzeptanzkriterien und Reihenfolge |
| [tickets.md](tickets.md) | Priorisierte Tickets nach Phase |

### Modulspezifikationen (`modules/`)

| Datei | Modul |
|---|---|
| [modules/client.md](modules/client.md) | Client – Felder, Validierung, Service-Logik |
| [modules/project.md](modules/project.md) | Project + ProjectRate + ProjectBudget |
| [modules/task.md](modules/task.md) | Task / Aktivität |
| [modules/tag.md](modules/tag.md) | Tag |
| [modules/timeentry.md](modules/timeentry.md) | TimeEntry – Kern der Anwendung |
| [modules/timer.md](modules/timer.md) | RunningTimer – Lifecycle, Start/Stop/Discard |
| [modules/report.md](modules/report.md) | Report – Queries, Filter, Metriken, Export |
| [modules/dashboard.md](modules/dashboard.md) | Dashboard – Aggregationen für die Startseite |
| [modules/settings.md](modules/settings.md) | AppSettings – Schlüssel-Wert-Konfiguration |

### Regeln (`rules/`)

| Datei | Inhalt |
|---|---|
| [rules/business-rules.md](rules/business-rules.md) | Raten, Umsatz, Budget, Rundung |
| [rules/coding-standards.md](rules/coding-standards.md) | Coding-Richtlinien für Backend und Frontend |

### Frontend (`frontend/`)

| Datei | Inhalt |
|---|---|
| [frontend/architecture.md](frontend/architecture.md) | Angular-Projektstruktur, State, Routing |
| [frontend/design-system.md](frontend/design-system.md) | Design-System, Farben, Spacing, Komponenten |

## Verwendung

Diese Dateien sind so strukturiert, dass ein Implementierungsauftrag pro Modul oder Phase erteilt werden kann, ohne die gesamte CLAUDE.md durcharbeiten zu müssen. Jede Datei ist in sich vollständig und cross-referenziert verwandte Dateien.

## Letztes Update

2026-06-19
