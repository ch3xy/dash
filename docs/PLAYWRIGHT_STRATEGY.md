# Dash: Playwright-Strategie

Stand: 08.11.2026. Regeln: [PLAYWRIGHT_RULES.md](PLAYWRIGHT_RULES.md).

## Iststand und Ausführung

Die Suite in `frontend/e2e/` wurde von drei auf 33 Fälle erweitert.
Ausführung: `cd frontend && npm run e2e:typecheck && npm run e2e`.
Startbedingungen, Umgebungsvariablen, Daten-Lifecycle und offene Lücken:
[E2E-Dokumentation](../frontend/e2e/README.md).

Die Konfiguration unterstützt `E2E_BASE_URL`, `E2E_API_URL` (API-Helfer) und
`PW_CHROMIUM_EXECUTABLE`, verwendet Europe/Vienna und einen Worker für globale
Timer-/Einstellungszustände. Sie startet keinen eigenen Stack. Ausschließlich eine
dedizierte Testinstanz verwenden. Eigene Fixture-Einträge werden gelöscht,
Projekte/Tags mangels Lösch-API archiviert, Einstellungen zurückgesetzt und der
Testmonat freigegeben. Für einen vollständig sauberen Zustand Testdatenbank neu erstellen.

## Abdeckungsmatrix

| Bereich | Implementiert / verbleibende Lücken |
|---|---|
| App-Shell | Hauptnavigation, Fallback, Mobilmenü, globale Projektsuche |
| Timer | Start/Stop, Reload, Beschreibung, Verwerfen; Konflikt/Fortsetzen/Bulk offen |
| Reports | Projektfilter, Detailansicht, Filterpersistenz, CSV/XLSX; weitere Kombinationen und Pagination offen |
| Stammdaten | Kunden anlegen/bearbeiten/archivieren/löschen, Projekte anlegen/bearbeiten/Status, Tasks, Tags, Ratenhistorie |
| Zeiterfassung | Manuelle Einträge, Bearbeiten/Löschen/Aufteilen, Timesheet-Zellen, Kalenderbearbeitung; Drag/Resize/Touch und Mitternacht offen |
| Daten | Backup-Download, Restore-Abbruch, CSV-Import/Duplikate, bestätigte Datenlöschung; vollständiger Restore offen |
| Monatsabschluss | Sperren, Bearbeitungssperre, Löschsperre, bestätigte Freigabe, Fehler/Retry |
| Einstellungen | Speichern/Reload, Theme-Persistenz/Systemfarbschema |

Die Abläufe verwenden den echten Stack; nur der gezielte Ladefehler wird simuliert.
Download-Tests prüfen den erfolgreichen Abschluss, nicht sämtliche fachlichen Dateiinhalte.
Aktuelle Laufergebnisse: [Prüfbericht](../frontend/e2e/VALIDATION.md).

## Definition of Done und spätere CI

Neue sichtbare Features und Bugfixes brauchen passende Playwright-Regression im selben Repository/PR, Hauptablauf und relevante Fehler-/Validierungsfälle; Bugfixes reproduzieren den ursprünglichen Fehler. Die Matrix wird mit den tatsächlich implementierten Fällen aktualisiert. Fehlendes Testsetup ist eine zu schließende Lücke, kein bestandener Check.

Vor Abschluss passende Anwendungstests, E2E-Typecheck, komplette Chromium-Suite und relevante Mobilfälle ausführen und App-Commit, Browserstand, Ergebnisse und Einschränkungen dokumentieren. Noch fehlende Prüfschritte ausdrücklich benennen.

Playwright bleibt zunächst außerhalb des normalen Builds und Deploys. Künftiger separater GitHub-Job: denselben Commit auschecken, isolierte Testumgebung starten, Suite ausführen, Fehlerartefakte sichern und immer aufräumen. Erst nach bewusster Aktivierung an PR/Build koppeln und als Required Check einrichten. In diesem Repository wird jetzt kein Workflow aktiviert.
