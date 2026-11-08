# Dash: Playwright-Strategie

Stand: 08.11.2026. Regeln: [PLAYWRIGHT_RULES.md](PLAYWRIGHT_RULES.md).

## Iststand und Ausführung

Die erste Bestandsaufnahme fand drei Fälle in `frontend/e2e/app.spec.ts` mit `frontend/playwright.config.ts` und `cd frontend && npm run e2e`. Während der Dokumentation wird diese Suite parallel erweitert (`master-data.spec.ts`, `data-closing.spec.ts`, gemeinsame Helfer). Der aktuelle Quellcode ist maßgeblich; diese Dokumentation ist kein Prüfbericht dieses parallelen Ausbaus.

Die aktuelle Konfiguration unterstützt `E2E_BASE_URL` und `PW_CHROMIUM_EXECUTABLE`, verwendet Europe/Vienna und einen Worker für globale Timer-/Einstellungszustände. Sie startet keinen eigenen Stack. Deshalb nur gegen eine dedizierte Dash-Testinstanz ausführen, niemals gegen die persönliche Entwicklungsdatenbank. Die konkreten Start-/Datenregeln der Suite vor dem Lauf lesen. Diese Dokumentationsänderung migriert oder startet die vorhandene Suite nicht.

Zielstruktur für einen späteren Ausbau: eigenes `e2e/`-npm-Paket im Dash-Repository, dedizierter PostgreSQL-/Backend-/Frontend-Stack, eigene Testdaten mit Cleanup, explizite Freigabe für Mutationstests und Typecheck. Bestehende Tests vorher auf Isolation und Ergebnisassertionen prüfen.

## Ausbauziele nach der ersten Bestandsaufnahme

| Bereich | Iststand / nächster Ausbau |
|---|---|
| App-Shell | vorhandener Navigationsfall; Mobilmenü ergänzen |
| Timer | vorhandener Start-/Stopp-Fall; Konflikt, Fortsetzen, Verwerfen, Reload ergänzen |
| Reports | vorhandener Fall für gebuchte Zeit; exakte Dauer/Umsatz, Filter und Export ergänzen |
| Stammdaten | Kunden, Projekte, Tasks, Tags: CRUD, Archivierung und Validierung geplant |
| Zeit und Raten | manuelle Einträge, Mitternacht, historische Rate, Budget und Rundung geplant |
| Einstellungen/Fehler | Persistenz, Themes, Sprache, Fehler und Wiederholung geplant |

Die Tabelle beschreibt die ursprüngliche Bestandsaufnahme und Ausbauziele. Parallel ergänzte Fälle können Teile davon bereits abdecken; ihren tatsächlichen Stand und Prüfnachweis bei Lieferung in diese Matrix übernehmen. Die Dash-Suite wurde für diese Dokumentationsänderung nicht ausgeführt.

## Definition of Done und spätere CI

Neue sichtbare Features und Bugfixes brauchen passende Playwright-Regression im selben Repository/PR, Hauptablauf und relevante Fehler-/Validierungsfälle; Bugfixes reproduzieren den ursprünglichen Fehler. Die Matrix wird mit den tatsächlich implementierten Fällen aktualisiert. Fehlendes Testsetup ist eine zu schließende Lücke, kein bestandener Check.

Vor Abschluss passende Anwendungstests, E2E-Typecheck, komplette Chromium-Suite und relevante Mobilfälle ausführen und App-Commit, Browserstand, Ergebnisse und Einschränkungen dokumentieren. Noch fehlende Prüfschritte ausdrücklich benennen.

Playwright bleibt zunächst außerhalb des normalen Builds und Deploys. Künftiger separater GitHub-Job: denselben Commit auschecken, isolierte Testumgebung starten, Suite ausführen, Fehlerartefakte sichern und immer aufräumen. Erst nach bewusster Aktivierung an PR/Build koppeln und als Required Check einrichten. In diesem Repository wird jetzt kein Workflow aktiviert.
